#!/usr/bin/env bash
# Deploy the latest code: back up the database, rebuild, restart, and check health.
# Run on the server from the repository folder:  bash deploy/deploy.sh
# GitHub Actions runs this automatically after each push to main (see .github/workflows/deploy.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
compose() { docker compose -f deploy/compose.yaml "$@"; }

[ -f deploy/.env ] || { echo "deploy/.env is missing. Run deploy/setup-server.sh first."; exit 1; }
grep -q '^DEV_LOGIN="true"' deploy/.env && { echo "DEV_LOGIN must be false in production."; exit 1; }

echo "==> Getting the latest code"
git pull --ff-only

if compose ps --status running db | grep -q db; then
  echo "==> Backing up the database before the update"
  compose build backup
  compose run --rm backup node backup.mjs backup
fi

echo "==> Building and starting (migrations run before the app starts)"
compose up -d --build --remove-orphans

echo "==> Waiting for the app to report healthy"
for _ in $(seq 1 30); do
  if compose exec -T app node -e "fetch('http://localhost:3000/api/health').then(r=>r.json()).then(j=>process.exit(j.database?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "App is up."
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done
echo "App did not become healthy. Recent logs:"
compose logs --tail=80 app migrate
exit 1
