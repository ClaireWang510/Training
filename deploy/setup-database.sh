#!/bin/sh
# 由服务器管理员以 root 身份执行一次，创建本系统使用的 PostgreSQL 角色与数据库。
#
#   sudo -u postgres PGDATABASE=training PGUSER=training PGPASSWORD='你的密码' ./deploy/setup-database.sh
#
# 也可先准备好 .env（含 PGPASSWORD），脚本会自动读取。幂等：已存在则跳过创建。

set -e
cd "$(dirname "$0")/.."

# 优先读取项目 .env 中的数据库参数
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

DB_NAME="${PGDATABASE:-training}"
DB_USER="${PGUSER:-training}"
DB_PASSWORD="${PGPASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
    echo "错误：请先设置 PGPASSWORD（可在 .env 中配置，或通过环境变量传入）。" >&2
    exit 1
fi

echo "==> 创建角色 ${DB_USER}"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
    echo "    角色已存在，跳过创建"
else
    sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
SQL
    echo "    已创建"
fi

echo "==> 创建数据库 ${DB_NAME}"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    echo "    数据库已存在，跳过创建"
else
    sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL
    echo "    已创建"
fi

echo "==> 授权"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
SQL

echo "==> 验证连接"
PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT current_user, current_database()"

echo
echo "完成。应用配置见 ./.env"
