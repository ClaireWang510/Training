#!/bin/sh
# 把学生骨干培训管理系统挂到现有 nginx 的 /training/ 子路径下。
#
# 需要 root 权限（写入 /etc/nginx 并 reload nginx）：
#   sudo /opt/training/deploy/install-nginx.sh
#
# 幂等：已存在 location /training/ 时直接退出。脚本会先备份原配置，
# 修改后执行 nginx -t 校验，通过才 reload。

set -e

CONF=/etc/nginx/sites-available/flask_app
MARK='# ============ 学生骨干培训管理系统'

if [ "$(id -u)" -ne 0 ]; then
    echo "请用 root 执行：sudo $0" >&2
    exit 1
fi

if grep -q 'location /training/' "$CONF" 2>/dev/null; then
    echo "已存在 /training/ 配置，跳过。"
    exit 0
fi

BACKUP="${CONF}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$CONF" "$BACKUP"
echo "已备份：$BACKUP"

python3 - "$CONF" <<'PY'
import sys

path = sys.argv[1]
text = open(path, encoding="utf-8").read()

block = '''
    # ============ 学生骨干培训管理系统 -> gunicorn 127.0.0.1:8003 ============
    location = /training {
        return 301 /training/;
    }

    location /training/ {
        client_max_body_size 12m;
        proxy_pass http://127.0.0.1:8003/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
    }
'''

# 在文件最后一个右花括号（server 块结束）之前插入
idx = text.rstrip().rfind("}")
if idx == -1:
    raise SystemExit("未找到 server 块的结束花括号，放弃修改")
new = text[:idx] + block + "\n" + text[idx:]
open(path, "w", encoding="utf-8").write(new)
print("已插入 /training/ location")
PY

if nginx -t; then
    systemctl reload nginx
    echo "nginx 已重载。访问：http://<域名或公网IP>/training/"
else
    echo "nginx 配置校验失败，正在回滚……" >&2
    cp "$BACKUP" "$CONF"
    nginx -t && systemctl reload nginx
    echo "已回滚到修改前配置。" >&2
    exit 1
fi
