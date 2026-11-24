# 部署指南

本文档说明如何把系统部署到一台 Linux 服务器。示例使用**用户级 systemd**（无需 root 即可让服务常驻），也可按需改为系统级服务。

以下命令默认在应用目录（记为 `$APP_DIR`）内执行。

## 1. 环境要求

- CPython 3.12、Linux x86-64、glibc 2.17 或更高
- 可连接的 PostgreSQL 服务（或使用内置 SQLite 做单机试用）
- 可选：nginx 等反向代理，用于 HTTPS 与域名访问

## 2. 虚拟环境与依赖

联网环境：

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

离线环境（使用仓库内 `wheels/`）：

```sh
python3.12 -m venv .venv
.venv/bin/pip install --no-index --find-links wheels -r requirements.txt
```

## 3. 运行配置

```sh
cp deploy/training.env.example .env
chmod 600 .env
$EDITOR .env
```

必填项：

- `ALLOWED_HOSTS`：允许访问的主机名或 IP，逗号分隔
- `CSRF_TRUSTED_ORIGINS`：浏览器请求来源，逗号分隔
- `TRAINING_DATA`：实例数据目录（密钥、SQLite 数据库）
- PostgreSQL 连接参数（`PGDATABASE` 等）；`PGDATABASE` 留空则使用 SQLite
- `HTTPS_ONLY=1`：仅在 HTTPS 网关后启用

`.env` 含敏感信息，**不要提交到版本库**（已在 `.gitignore` 中忽略）。

## 4. 初始化数据库

```sh
set -a; . ./.env; set +a
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py check
```

## 5. 启动服务（用户级 systemd）

```sh
mkdir -p ~/.config/systemd/user
cp deploy/training.service deploy/training-sheets.service deploy/training-sheets.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now training.service training-sheets.timer
systemctl --user status training.service training-sheets.timer
```

按实际路径调整服务单元中的 `WorkingDirectory`、`EnvironmentFile`、`ExecStart`。

开机自动启动需管理员执行一次：

```sh
sudo loginctl enable-linger "$USER"
```

## 6. 定时冻结签到名单

`training-sheets.timer` 每分钟为已截止的活动生成一份固定的签到 Excel，重复执行复用同一份文件。管理员在截止后首次访问签到表也会触发生成。

```sh
systemctl --user list-timers training-sheets.timer
.venv/bin/python manage.py finalize_sheets    # 手动触发一次
```

## 7. PostgreSQL（可选）

若使用 PostgreSQL，可由管理员创建角色与数据库：

```sh
# 先确保 .env 中已设置 PGPASSWORD
sudo -u postgres ./deploy/setup-database.sh
```

或使用一键脚本完成建库、迁移与重启：

```sh
./deploy/provision-postgres.sh
```

只想单机试用时，把 `.env` 中 `PGDATABASE` 留空并重启服务即可。

## 8. 反向代理与 HTTPS

建议在网关（nginx 等）上把请求代理到应用监听端口，并：

- 保留原始 `Host`；
- 覆盖 `X-Forwarded-Proto` 为实际协议；
- 上传上限至少 10 MB（照片识别）；
- 代理响应超时至少 60 秒；
- 在 `.env` 中设置 `HTTPS_ONLY=1` 与对应的 `CSRF_TRUSTED_ORIGINS`。

若通过子路径（例如 `/training/`）对外，前端资源与接口均使用相对路径，可被正确代理；注意把 `<前缀>/` 反代到应用根路径。

## 9. 备份与恢复

PostgreSQL：

```sh
set -a; . ./.env; set +a
pg_dump --format=custom --file=training-backup.dump
createdb training_restore
pg_restore --exit-on-error --no-owner --dbname=training_restore training-backup.dump
```

SQLite：

```sh
sqlite3 "$TRAINING_DATA/training.sqlite3" ".backup 'training-backup.sqlite3'"
```

另需单独保存 `.env`（含数据库密码）与 `TRAINING_DATA/secret`（实例密钥）。

## 10. 校验

```sh
curl -fsS http://127.0.0.1:8003/api/health
set -a; . ./.env; set +a
.venv/bin/python manage.py test
```
