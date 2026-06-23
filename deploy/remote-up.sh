#!/usr/bin/env bash
# Runs on the server. Pulls pre-built images from GHCR and (re)starts the stack.
# Images are built in GitHub Actions — this host never compiles Go or runs npm.
set -uo pipefail

cd /opt/avartworks || exit 1
echo $$ > /opt/avartworks/deploy.pid

docker compose -f docker-compose.prod.yml --env-file .env pull
code=$?

if [ "$code" -eq 0 ]; then
  docker compose -f docker-compose.prod.yml --env-file .env up -d
  code=$?
fi

# Nginx caches upstream IPs at start; restart web so it picks up gateway changes.
if [ "$code" -eq 0 ]; then
  docker compose -f docker-compose.prod.yml --env-file .env restart web
fi

# Reclaim dangling layers from previous pull/up cycles.
docker image prune -f >/dev/null 2>&1 || true

echo "$code" > /opt/avartworks/deploy.exit
rm -f /opt/avartworks/deploy.pid
exit "$code"
