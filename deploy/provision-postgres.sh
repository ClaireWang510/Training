#!/bin/sh
# 切换到 PostgreSQL 的一键脚本。
#
# 前提：由拥有 sudo 权限的账户执行一次（创建角色与数据库需要超级用户），
# 且 .env 中已设置 PGPASSWORD。
#
# 用法：
#   cd /opt/training
#   ./deploy/provision-postgres.sh
#
# 脚本会：
#   1. 复用 deploy/setup-database.sh 创建角色与数据库（已存在则跳过）
#   2. 打开 .env 中的 PGDATABASE
#   3. 执行数据库迁移
#   4. 重启服务并做健康检查
#
# 幂等：可重复执行。已有 SQLite 数据不会被自动迁移；如需迁移请先备份并手动导入。

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

DB_NAME="${PGDATABASE:-training}"

if [ -z "${PGPASSWORD:-}" ]; then
    echo "错误：请先在 .env 中设置 PGPASSWORD。" >&2
    exit 1
fi

echo "==> 1/4 创建 PostgreSQL 角色与数据库"
sh ./deploy/setup-database.sh

echo "==> 2/4 打开 .env 中的 PostgreSQL 配置"
sed -i "s/^PGDATABASE=.*/PGDATABASE=${DB_NAME}/" .env
grep -q '^PGUSER=' .env || echo "PGUSER=${PGUSER:-training}" >> .env
chmod 600 .env

echo "==> 3/4 执行数据库迁移"
set -a
# shellcheck disable=SC1091
. ./.env
set +a
.venv/bin/python manage.py migrate
.venv/bin/python manage.py check

echo "==> 4/4 重启服务并检查"
systemctl --user restart training.service
sleep 3
curl -fsS http://127.0.0.1:8003/api/health && echo

echo
echo "已切换到 PostgreSQL。若需管理员账号，请执行："
echo "  cd . && set -a && . ./.env && set +a && .venv/bin/python manage.py createsuperuser"
