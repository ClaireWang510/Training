# 学生骨干培训管理系统

基于 Django 的多期培训班管理系统。管理员在浏览器中创建班期、导入学员、发布活动与问卷、登记出勤与学分；学员用姓名和学号登录，完成活动报名并查看本人学分记录。

- 服务端：Django 5 + PostgreSQL（或 SQLite）
- 前端：原生 ES 模块 + 原生 CSS，**无需构建步骤**
- 部署：gunicorn + systemd（支持用户级部署，无需 root）

## 功能特性

- **多期培训班**：普通管理员管理自己创建的班期，超级管理员管理全部班期。
- **学员名单**：导入 XLSX 或 UTF-8 CSV，自动识别工作表与表头，预览重复与冲突后提交；服务端再次校验，跨期姓名冲突整批回滚。点击姓名可查看学院、年级、性别、联系方式与邮箱，管理员可直接编辑学员资料。
- **活动与问卷**：必修/选修、学分、开课与报名截止时间，可自定义单选/多选/简答题。
- **报名管理**：分享链接与二维码，学员在截止前可报名、修改、取消；服务端以北京时间判断截止。
- **签到表**：导出 XLSX、打印 A4 版式（每页 15 人，含印次/编号/页码），截止后由定时任务冻结为正式名单。
- **出勤与学分**：手工登记、照片识别辅助复核；只有确认的状态才写入学分，并记录修改人、时间与前后值。
- **学分总表**：按学员汇总必修/选修/总分，支持补修与更正，可导出 Excel；与学员名单统一分页浏览与搜索筛选。
- **登录限流**：同一来源地址的登录尝试次数受限，跨进程共享计数。

## 技术栈

| 层 | 选型 |
| --- | --- |
| Web 框架 | Django 5.2 |
| 数据库 | PostgreSQL 16（默认）/ SQLite（单机） |
| 应用服务器 | gunicorn |
| 前端 | 原生 ES Modules、原生 CSS（无打包） |
| 离线依赖 | `wheels/` 下的预下载 wheel 包 |

## 目录结构

```
.
├── manage.py               Django 管理入口
├── settings.py             配置（从环境变量读取）
├── urls.py                 路由
├── wsgi.py                 gunicorn 入口
├── requirements.txt        依赖清单
├── core/                   业务应用
│   ├── models.py           数据模型
│   ├── views.py            接口与页面
│   ├── vision.py           签到照片识别适配器
│   ├── sheetfile.py        签到表 XLSX 生成
│   ├── migrations/         数据库迁移
│   ├── tests.py            单元测试
│   └── management/commands/finalize_sheets.py
├── templates/index.html    单页应用外壳
├── static/                 前端资源（见下文）
├── wheels/                 离线安装用 wheel 包
└── deploy/                 部署脚本与服务单元
```

## 快速开始（本地开发）

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt        # 联网环境
# 或离线：.venv/bin/pip install --no-index --find-links wheels -r requirements.txt

cp deploy/training.env.example .env
chmod 600 .env
# 编辑 .env：至少设置 ALLOWED_HOSTS；不配 PGDATABASE 时自动使用 SQLite

set -a; . ./.env; set +a
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

浏览器打开 <http://127.0.0.1:8000/>，在登录页选择「管理员登录」即可开始。

## 配置说明

所有运行参数通过环境变量（`.env`）注入，**不要把 `.env` 提交到版本库**。

| 变量 | 说明 |
| --- | --- |
| `ALLOWED_HOSTS` | 允许访问的主机名/IP，逗号分隔 |
| `CSRF_TRUSTED_ORIGINS` | 允许的跨站请求来源，逗号分隔 |
| `HTTPS_ONLY` | `1` 时启用安全 Cookie 与代理 SSL 头 |
| `TRAINING_DATA` | 实例数据目录（密钥、SQLite 数据库） |
| `PGDATABASE` 等 | PostgreSQL 连接参数；`PGDATABASE` 为空时使用 SQLite |
| `VISION_CHAT_URL` / `VISION_MODEL` / `VISION_TOKEN` | 可选的签到照片识别服务 |

`DJANGO_SECRET_KEY` 未设置时，系统会在 `TRAINING_DATA` 下自动生成并持久化一个密钥文件。

## 运行测试

```sh
set -a; . ./.env; set +a
.venv/bin/python manage.py test
```

测试使用临时数据库，不影响正式数据。PostgreSQL 模式下测试账号需具备创建测试库的权限。

## 生产部署

详见 [`deploy/README.md`](deploy/README.md)。概要：

1. 准备虚拟环境与 `.env`；
2. `manage.py migrate` 与 `createsuperuser`；
3. 安装 `deploy/` 下的 systemd 单元并启用；
4. 由 HTTPS 网关反向代理到应用端口（保留原始 Host、覆盖 `X-Forwarded-Proto`、上传上限 ≥ 10 MB、超时 ≥ 60 秒）；
5. `training-sheets.timer` 每分钟为已截止活动冻结签到名单。

## 前端代码组织

前端为原生 ES 模块，无需构建步骤，服务端直接提供 `static/` 下的文件。

```
static/
├── css/                样式表，按层拆
│   ├── tokens.css      设计变量：颜色、排版、间距的唯一来源
│   ├── base.css        重置、页头页脚、页面骨架
│   ├── components.css  通用组件：按钮、表单、表格、对话框
│   ├── admin.css       管理员视图：概览、学分总表
│   ├── events.css      活动管理视图
│   ├── roster.css      学员名单与导入向导
│   └── student.css     学员视图
└── js/
    ├── app.js          入口：装配全局事件、启动应用
    ├── lib/            通用能力
    │   ├── dom.js      安全 HTML 模板、元素创建、日期格式化
    │   ├── api.js      后端接口调用与错误封装
    │   ├── store.js    应用状态与派生数据
    │   ├── ui.js       对话框、提示条、图标
    │   ├── actions.js  写操作与状态同步
    │   ├── renderer.js 页面渲染分发
    │   ├── navigation.js 视图切换与班期切换
    │   ├── interactions.js 交互路由（data-* 属性 → 动作）
    │   ├── xlsx-read.js    XLSX / CSV 读取（名单导入）
    │   ├── xlsx-write.js   XLSX 写出（名单、学分表导出）
    │   ├── qr.js           二维码 SVG 生成
    │   └── qr-encoder.js   二维码编码器（第三方实现，独立成文件）
    └── pages/          页面模块
        ├── home.js     本期概览、培训班管理、班期编辑
        ├── events.js   活动列表、详情、问卷、出勤、分享、打印
        ├── roster.js   名单浏览、学员详情与资料编辑、导入向导
        ├── ledger.js   学分总表与补修登记
        └── student.js  学员报名与我的学分
```

约定：

- **状态集中管理**：全局状态收拢在 `lib/store.js`，页面模块只读状态。
- **模板默认转义**：`html` 标签模板对插值做 HTML 转义，需要插入已构建片段时显式使用 `raw()`。
- **不用内联事件**：交互统一写成 `data-action`、`data-event` 等属性，由 `lib/interactions.js` 映射到页面函数。
- **样式不写在 JS 里**：所有样式位于 `css/` 目录。
- **依赖方向单一**：页面模块依赖 `lib/`，`lib/` 不反向依赖页面；`renderer.js` 通过动态 `import` 装载页面，避免循环依赖。

新增页面时，在 `js/pages/` 下新建模块并导出 `render*` 函数，再在 `lib/renderer.js` 中登记。

## 使用流程

1. **管理员登录** → 新建培训班（班名与起止日期）。
2. **导入学员名单**（XLSX/CSV，确认姓名、学号、学院、班级四个必填列，年级、性别、联系方式与邮箱可选填）。
3. **创建活动**，设置学分、开课与报名截止时间，按需添加问卷题，分享链接或二维码。
4. **导出/打印签到表**（印次对应服务器上的固定名单）。
5. **登记出勤与学分**（可手工或照片复核，仅确认状态计分）。
6. **学分总表**中登记补修、更正得分，导出 Excel。

学员用「姓名 + 学号」登录，仅能看到本人的参训、报名与得分记录。

## 签到照片识别（可选）

配置 `VISION_CHAT_URL` / `VISION_MODEL` 后，可上传签到表照片获取到课建议。服务端会校验印次、行号与学号尾号，仅把清晰签名列为建议，最终以人工确认为准。未配置时可在同一入口改用人工核对。原始图片不持久保存。

## 数据备份

PostgreSQL 模式：

```sh
set -a; . ./.env; set +a
pg_dump --format=custom --file=training-backup.dump
```

SQLite 模式：`sqlite3 "$TRAINING_DATA/training.sqlite3" ".backup 'backup.sqlite3'"`。
另需单独保存 `.env` 与 `TRAINING_DATA/secret`。

## 安全与隐私

- 仓库**不包含**任何环境密钥、数据库密码、真实学员名单或试用账号；`.env`、`data/` 已在 `.gitignore` 中忽略。
- 学员登录凭据为「姓名 + 学号」，知道这两项的人可以冒用身份；接入学校统一身份认证时可替换登录层，按学号关联同一学员记录。
- 管理员使用独立密码；建议启用登录限流并定期轮换密码。
- 通过 HTTPS 网关对外时设置 `HTTPS_ONLY=1` 并正确配置 `CSRF_TRUSTED_ORIGINS`。

## 许可证

内部培训管理系统。第三方二维码编码器（`static/js/lib/qr-encoder.js`）来自 Kazuhiko Arase 的 QR Code 生成器，遵循 MIT 许可。
