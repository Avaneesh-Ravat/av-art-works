#!/usr/bin/env bash
# Builds all app images for linux/arm64 (Graviton EC2) and pushes to GHCR.
# Runs in GitHub Actions — not on the production host.
set -euo pipefail

: "${GHCR_OWNER:?GHCR_OWNER is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

OWNER_LC="$(echo "$GHCR_OWNER" | tr '[:upper:]' '[:lower:]')"
REGISTRY="ghcr.io/${OWNER_LC}/av-art-works"

build() {
  local svc="$1"
  local dockerfile="$2"
  local image="${REGISTRY}-${svc}"

  echo "==> ${image}:${IMAGE_TAG}"
  docker buildx build \
    --platform linux/arm64 \
    --file "$dockerfile" \
    --tag "${image}:${IMAGE_TAG}" \
    --tag "${image}:latest" \
    --push \
    .
}

build user-service services/user-service/Dockerfile
build catalog-service services/catalog-service/Dockerfile
build order-service services/order-service/Dockerfile
build payment-service services/payment-service/Dockerfile
build gateway services/gateway/Dockerfile
build web web/Dockerfile

echo "All images pushed to ${REGISTRY}-*:${IMAGE_TAG}"
