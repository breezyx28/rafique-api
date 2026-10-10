#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Deploying rafique-api from $ROOT"

if [ -n "${ENV_SECRET:-}" ]; then
  node scripts/decode-env.js --to-root
fi

npm install
rm -f tsconfig.build.tsbuildinfo tsconfig.tsbuildinfo
npx nest build
if [ ! -f dist/main.js ]; then
  echo "Build did not produce dist/main.js"
  find dist -name main.js -print 2>/dev/null || true
  exit 1
fi

# Leftover untracked InitialSchema files from early server copies break migrate.
rm -f src/migrations/*InitialSchema* dist/migrations/*InitialSchema* \
  src/migrations/1773190406192* dist/migrations/1773190406192*

node scripts/baseline-migrations.js
npx typeorm-ts-node-commonjs migration:run -d src/config/typeorm.config.ts

# PM2 does not read .env itself. Put those values in the process environment
# before start, so a restart still has the database settings.
eval "$(node -e '
const fs = require("fs");
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'\''") && value.endsWith("'\''"))) {
    value = value.slice(1, -1);
  }
  process.stdout.write("export " + key + "=" + JSON.stringify(value) + "\n");
}
')"

pm2 flush rafique-api >/dev/null 2>&1 || true
if pm2 describe rafique-api >/dev/null 2>&1; then
  pm2 delete rafique-api
fi
pm2 start dist/main.js --name rafique-api --cwd "$ROOT"
pm2 save

PORT="$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"\r' || true)"
PORT="${PORT:-3001}"

echo "Checking http://127.0.0.1:${PORT}/api/health"
HEALTH=""
for _ in $(seq 1 30); do
  if HEALTH="$(curl -sf "http://127.0.0.1:${PORT}/api/health")"; then
    break
  fi
  HEALTH=""
  sleep 1
done

if [ -z "$HEALTH" ]; then
  echo "API did not answer on port ${PORT}"
  pm2 status rafique-api || true
  pm2 logs rafique-api --lines 120 --nostream || true
  exit 1
fi

echo "$HEALTH"
echo "$HEALTH" | grep -q '"version":"0.1.1"'
echo "$HEALTH" | grep -q 'dashboard/overview'
echo "$HEALTH" | grep -q 'workshop/orders'

pm2 list
echo "Deploy OK"
