#!/bin/bash
# Bootstrap an Amazon Linux 2023 host to run the Docker Compose stack.
set -euxo pipefail

dnf update -y
dnf install -y docker git rsync

# 2 GB swap: a t4g.small has only 2 GB RAM; swap prevents OOM during image builds.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

systemctl enable --now docker
usermod -aG docker ec2-user

# Install the Docker Compose + buildx CLI plugins (compose build needs buildx).
DOCKER_CONFIG=/usr/local/lib/docker
mkdir -p "$DOCKER_CONFIG/cli-plugins"
ARCH="$(uname -m)" # aarch64 on Graviton
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
  -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"

BUILDX_VER="$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep -m1 tag_name | cut -d'"' -f4)"
BUILDX_ARCH="arm64"
[ "$ARCH" = "x86_64" ] && BUILDX_ARCH="amd64"
curl -SL "https://github.com/docker/buildx/releases/download/${BUILDX_VER}/buildx-${BUILDX_VER}.linux-${BUILDX_ARCH}" \
  -o "$DOCKER_CONFIG/cli-plugins/docker-buildx"
chmod +x "$DOCKER_CONFIG/cli-plugins/docker-buildx"

# App directory the CI/CD pipeline deploys into.
mkdir -p /opt/avartworks
chown ec2-user:ec2-user /opt/avartworks
