#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "$EUID" -ne 0 ]]; then
  echo 'Run with sudo; the script needs Docker and protected configuration access.' >&2
  exit 1
fi
docker compose version >/dev/null
python3 - <<'PY'
from pathlib import Path
import json, os, secrets
from urllib.parse import urlparse

path = Path('.env')
if not path.exists():
    db_password = secrets.token_hex(32)
    values = {
        'MYSQL_DATABASE': 'partsbox', 'MYSQL_USER': 'partsbox',
        'MYSQL_PASSWORD': db_password, 'MYSQL_ROOT_PASSWORD': secrets.token_hex(32),
        'DATABASE_URL': f'mysql+pymysql://partsbox:{db_password}@mysql:3306/partsbox?charset=utf8mb4',
        'SECRET_KEY': secrets.token_hex(32), 'ADMIN_USERNAME': 'admin',
        'ADMIN_PASSWORD': secrets.token_urlsafe(18), 'APP_PORT': '8000',
    }
else:
    values = dict(line.split('=', 1) for line in path.read_text().splitlines()
                  if line and not line.startswith('#') and '=' in line)
origin = os.environ.get('PUBLIC_ORIGIN')
index_url = os.environ.get('PARTSBOX_PIP_INDEX_URL')
if index_url:
    if not index_url.startswith('https://'):
        raise SystemExit('PARTSBOX_PIP_INDEX_URL must use HTTPS')
    values['PARTSBOX_PIP_INDEX_URL'] = index_url
if origin:
    parsed = urlparse(origin)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.path not in ('', '/') or parsed.query or parsed.fragment or parsed.username:
        raise SystemExit('PUBLIC_ORIGIN must be an HTTP(S) origin without a path or credentials')
    origin = origin.rstrip('/')
    values['TRUSTED_ORIGINS'] = json.dumps([origin], separators=(',', ':'))
    values['COOKIE_SECURE'] = 'true' if parsed.scheme == 'https' else 'false'
temporary = path.with_suffix('.pending')
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as handle:
    handle.write(''.join(f'{k}={v}\n' for k, v in values.items()))
temporary.replace(path)
path.chmod(0o600)
print('Server configuration ready. Credentials are stored only in .env (mode 600).')
PY
docker compose -f compose.yaml -f deploy/compose.production.yaml config --quiet
docker compose -f compose.yaml -f deploy/compose.production.yaml up -d --build --wait --wait-timeout 180
curl --fail --silent --show-error http://127.0.0.1:8000/api/health
printf '\nPartsBox is running on loopback port 8000. Install deploy/nginx.conf to expose HTTP.\n'
