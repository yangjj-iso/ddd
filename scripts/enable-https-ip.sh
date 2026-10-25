#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "$EUID" -ne 0 || $# -ne 1 ]]; then
  echo 'Usage: sudo bash scripts/enable-https-ip.sh <public-ipv4>' >&2
  exit 1
fi
SERVER_IP="$(python3 -c 'import ipaddress,sys; print(ipaddress.IPv4Address(sys.argv[1]))' "$1")"
install -d -m 755 /var/lib/letsencrypt
if [[ ! -x /opt/partsbox-certbot/bin/certbot ]]; then
  python3 -m venv /opt/partsbox-certbot
  /opt/partsbox-certbot/bin/python -m pip install 'certbot>=5.4,<6'
fi
/opt/partsbox-certbot/bin/certbot certonly --non-interactive --agree-tos \
  --register-unsafely-without-email --preferred-profile shortlived --webroot \
  --webroot-path /var/lib/letsencrypt --ip-address "$SERVER_IP" \
  --cert-name partsbox-ip --deploy-hook 'systemctl reload nginx'
python3 - "$SERVER_IP" <<'PY'
from pathlib import Path
import sys
source = Path('deploy/nginx.https.conf.template').read_text()
Path('/etc/nginx/sites-available/partsbox').write_text(source.replace('__SERVER_IP__', sys.argv[1]))
PY
nginx -t
systemctl reload nginx
PUBLIC_ORIGIN="https://$SERVER_IP" bash scripts/setup-linux.sh
cat > /etc/systemd/system/partsbox-certbot-renew.service <<'EOF'
[Unit]
Description=Renew PartsBox IP TLS certificate
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/partsbox-certbot/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
cat > /etc/systemd/system/partsbox-certbot-renew.timer <<'EOF'
[Unit]
Description=Check PartsBox certificate twice daily
[Timer]
OnCalendar=*-*-* 03,15:00:00
RandomizedDelaySec=900
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now partsbox-certbot-renew.timer
curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
  --resolve "$SERVER_IP:443:127.0.0.1" "https://$SERVER_IP/api/health"
printf '\nHTTPS ready with automatic certificate renewal.\n'
