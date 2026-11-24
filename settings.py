import os
import secrets
from pathlib import Path

BASE = Path(__file__).resolve().parent
STATIC_ROOT = BASE / "static"
DATA = Path(os.getenv("TRAINING_DATA", BASE / "data"))
DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    keyfile = DATA / "secret"
    if not keyfile.exists():
        try:
            with open(os.open(keyfile, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "w") as f:
                f.write(secrets.token_urlsafe(48))
        except FileExistsError:
            pass
    SECRET_KEY = keyfile.read_text().strip()
DEBUG = False
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
ROOT_URLCONF = "urls"
INSTALLED_APPS = ["django.contrib.auth","django.contrib.contenttypes","django.contrib.sessions","core"]
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware","django.contrib.sessions.middleware.SessionMiddleware","django.middleware.csrf.CsrfViewMiddleware","django.contrib.auth.middleware.AuthenticationMiddleware","django.middleware.clickjacking.XFrameOptionsMiddleware"]
TEMPLATES = [{"BACKEND":"django.template.backends.django.DjangoTemplates","DIRS":[BASE/"templates"]}]
DATABASES = {"default":{"ENGINE":"django.db.backends.sqlite3","NAME":DATA/"training.sqlite3","OPTIONS":{"timeout":20,"transaction_mode":"IMMEDIATE"}}}
if os.getenv("PGDATABASE"):
    DATABASES["default"] = {"ENGINE":"django.db.backends.postgresql",**{k:os.getenv(v,"") for k,v in {"NAME":"PGDATABASE","USER":"PGUSER","PASSWORD":"PGPASSWORD","HOST":"PGHOST","PORT":"PGPORT"}.items()}}
LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SESSION_COOKIE_AGE = 8*3600
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = os.getenv("HTTPS_ONLY") == "1"
CSRF_TRUSTED_ORIGINS = [v for v in os.getenv("CSRF_TRUSTED_ORIGINS","").split(",") if v]
DATA_UPLOAD_MAX_MEMORY_SIZE = 12*1024*1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 8*1024*1024
if HTTPS_ENABLED := (os.getenv("HTTPS_ONLY") == "1"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
