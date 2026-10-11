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
# Kept alive by DirectAdmin Cron Jobs. SSH-started Node exits when the session ends on this host.
set -euo pipefail
APP=/home/cedarsd/domains/api.cedar.sd/app
PORT=4010
if curl -sf --max-time 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  exit 0
fi
cd "$APP"
mkdir -p logs
/usr/bin/setsid /usr/bin/node dist/main.js >> logs/api.log 2>&1 < /dev/null &
echo $! > api.pid
sleep 2
curl -sf --max-time 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null
EOF
chmod 700 "$STAGE/ensure-running.sh"

cat > "$STAGE/DIRECTADMIN-CRON.txt" <<'EOF'
This shared host ends Node processes that were started from SSH.

Create a Cron Job in DirectAdmin so the API stays up:

1. Open DirectAdmin as cedarsd
2. Go to Advanced Features -> Cron Jobs
   (some skins show it as Extra Features -> Cron Jobs)
3. Create a job:
   Minute: *
   Hour: *
   Day of Month: *
   Month: *
   Day of Week: *
   Command:
   /home/cedarsd/domains/api.cedar.sd/app/ensure-running.sh >/dev/null 2>&1
4. Save, wait one minute, then open:
   https://api.cedar.sd/api/health
EOF

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
rm -rf "${APP}.prev"

rm -f "$WEB/boot.php" "$WEB/cgi-bin/start-api.cgi"
cat > "$WEB/.htaccess" <<EOF
RewriteEngine On
RewriteRule ^api(/.*)?\$ http://127.0.0.1:${PORT}/api\$1 [P,L]
EOF

# Prove the release boots while this deploy session is still open.
cd "$APP"
/usr/bin/setsid /usr/bin/node dist/main.js >> logs/api.log 2>&1 < /dev/null &
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
  exit 1
fi

if curl -sf --max-time 15 "https://api.cedar.sd/api/health" >/dev/null; then
  echo "Public health check ok while the deploy session is open"
else
  echo "Local health check ok, public proxy check failed"
  exit 1
fi

echo
echo "IMPORTANT: this host kills Node after SSH ends."
echo "Add the DirectAdmin cron job described in:"
echo "  $APP/DIRECTADMIN-CRON.txt"
echo "Command to paste:"
echo "  /home/cedarsd/domains/api.cedar.sd/app/ensure-running.sh >/dev/null 2>&1"
echo "Schedule: every minute (* * * * *)"
echo
echo "Cedar API files, schema, and admin user are ready."

