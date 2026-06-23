#!/usr/bin/env bash
# Stops orphaned deploy/build processes left behind when CI times out.
# Does not stop running containers or remove volumes/data.
set -euo pipefail

cd /opt/avartworks 2>/dev/null || exit 0

if [ -f deploy.pid ]; then
  pid="$(cat deploy.pid 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "Stopping stale deploy pid ${pid}"
    kill "$pid" 2>/dev/null || true
    sleep 2
    kill -9 "$pid" 2>/dev/null || true
  fi
fi

pkill -f '/opt/avartworks/deploy/remote-up.sh' 2>/dev/null || true
pkill -f 'docker compose.*docker-compose.prod.yml.*(build|up)' 2>/dev/null || true
pkill -f 'docker-buildx build' 2>/dev/null || true

rm -f deploy.pid deploy.exit

# Give the kernel a moment to reclaim memory so sshd can respond again.
sleep 5
