#!/usr/bin/env bash
# Install a cedar API release on the shared host and swap it into place.
set -euo pipefail

APP=/home/cedarsd/domains/api.cedar.sd/app
WEB=/home/cedarsd/domains/api.cedar.sd/public_html
DEPLOY=/home/cedarsd/deploy
STAGE="$DEPLOY/api-stage"
PORT=4010

mkdir -p "$DEPLOY" "$WEB/cgi-bin"
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xzf "$DEPLOY/api-release.tar.gz" -C "$STAGE"

if [ -d "$APP/uploads" ]; then
  mkdir -p "$STAGE/uploads"
  cp -a "$APP/uploads/." "$STAGE/uploads/"
fi
mkdir -p "$STAGE/uploads" "$STAGE/logs"

if [ -z "${DB_PASSWORD_B64:-}" ]; then
  echo "Database password was not provided"
  exit 1
fi
DB_PASSWORD="$(printf '%s' "$DB_PASSWORD_B64" | base64 -d)"
cd "$STAGE"
DB_PASSWORD="$DB_PASSWORD" node -e '
const fs = require("fs");
const password = process.env.DB_PASSWORD;
if (!password) process.exit(1);
fs.writeFileSync(".env", [
  "DB_HOST=localhost",
  "DB_PORT=3306",
  "DB_USER=cedarsd_user",
  "DB_PASSWORD=" + password,
  "DB_NAME=cedarsd_db",
  "NODE_ENV=production",
  "PORT=4010",
  "",
].join("\n"));
'
unset DB_PASSWORD DB_PASSWORD_B64
chmod 600 .env

if [ ! -d node_modules ]; then
  echo "Release archive is missing node_modules"
  exit 1
fi
node scripts/cedar-ensure-schema.js
node dist/seed-admin.js

cat > "$STAGE/ensure-running.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APP=/home/cedarsd/domains/api.cedar.sd/app
if curl -sf --max-time 5 http://127.0.0.1:4010/api/health >/dev/null; then
  exit 0
fi
cd "$APP"
mkdir -p logs
nohup node dist/main.js >> logs/api.log 2>&1 < /dev/null &
echo $! > api.pid
EOF
chmod 700 "$STAGE/ensure-running.sh"

if [ -f "$APP/api.pid" ]; then
  kill "$(cat "$APP/api.pid")" 2>/dev/null || true
  sleep 1
fi
pkill -f "/home/cedarsd/domains/api.cedar.sd/app/dist/main.js" 2>/dev/null || true
sleep 1

rm -rf "${APP}.prev"
if [ -d "$APP" ]; then
  mv "$APP" "${APP}.prev"
fi
mv "$STAGE" "$APP"

cd "$APP"
nohup node dist/main.js >> logs/api.log 2>&1 < /dev/null &
echo $! > api.pid

healthy=0
for _ in $(seq 1 45); do
  if curl -sf --max-time 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  echo "API did not answer on 127.0.0.1:${PORT}"
  tail -n 80 logs/api.log || true
  kill "$(cat api.pid)" 2>/dev/null || true
  if [ -d "${APP}.prev" ]; then
    rm -rf "$APP"
    mv "${APP}.prev" "$APP"
    if [ -f "$APP/dist/main.js" ]; then
      cd "$APP"
      nohup node dist/main.js >> logs/api.log 2>&1 < /dev/null &
      echo $! > api.pid
    fi
  fi
  exit 1
fi
rm -rf "${APP}.prev"

cat > "$WEB/.htaccess" <<EOF
RewriteEngine On
RewriteRule ^(.*)\$ http://127.0.0.1:${PORT}/\$1 [P,L]
EOF

if curl -sf --max-time 15 "https://api.cedar.sd/api/health" >/dev/null; then
  echo "Public health check ok"
else
  echo "Local health check ok, public proxy check failed"
  exit 1
fi

CRON_LINE='*/5 * * * * /home/cedarsd/domains/api.cedar.sd/app/ensure-running.sh'
if (crontab -l 2>/dev/null | grep -v 'ensure-running.sh'; echo "$CRON_LINE") | crontab -; then
  echo "Restart cron installed"
else
  echo "Could not install a user crontab. Add this command in DirectAdmin -> Cron Jobs:"
  echo "$CRON_LINE"
fi

echo "Cedar API deploy ok"
