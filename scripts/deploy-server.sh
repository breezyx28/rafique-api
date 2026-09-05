#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Deploying rafique-api from $ROOT"

if [ -n "${ENV_SECRET:-}" ]; then
  node scripts/decode-env.js --to-root
fi

npm install
npx nest build
test -f dist/main.js

npx typeorm-ts-node-commonjs migration:run -d src/config/typeorm.config.ts

if pm2 describe rafique-api >/dev/null 2>&1; then
  pm2 restart rafique-api --update-env --cwd "$ROOT"
else
  pm2 start dist/main.js --name rafique-api --cwd "$ROOT"
fi
pm2 save

PORT="$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"\r' || true)"
PORT="${PORT:-3001}"
sleep 3

echo "Checking http://127.0.0.1:${PORT}/api/health"
HEALTH="$(curl -sf "http://127.0.0.1:${PORT}/api/health")"
echo "$HEALTH"
echo "$HEALTH" | grep -q '"version":"0.1.1"'
echo "$HEALTH" | grep -q 'dashboard/overview'
echo "$HEALTH" | grep -q 'workshop/orders'

pm2 list
echo "Deploy OK"
