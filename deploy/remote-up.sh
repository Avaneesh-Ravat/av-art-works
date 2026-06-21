#!/usr/bin/env bash
# Runs on the server. Builds + (re)starts the stack and records the result so a
# CI job can launch it detached (surviving SSH disconnects) and poll for status.
set -uo pipefail

cd /opt/avartworks || exit 1

docker compose -f docker-compose.prod.yml --env-file .env up -d --build
code=$?

docker image prune -f >/dev/null 2>&1 || true

echo "$code" > /opt/avartworks/deploy.exit
exit "$code"
