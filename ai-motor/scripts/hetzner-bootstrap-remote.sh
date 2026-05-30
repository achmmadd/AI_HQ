#!/usr/bin/env bash
# Run ON the Hetzner host (or via: ssh hetzner-motor 'bash -s' < hetzner-bootstrap-remote.sh)
set -euo pipefail

echo "== OS =="
uname -a
. /etc/os-release 2>/dev/null && echo "ID=$ID VERSION=$VERSION_ID" || true
echo "== Resources =="
free -h
df -h /

echo "== Docker =="
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || true
else
  echo "Installing Docker (get.docker.com)..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker 2>/dev/null || service docker start 2>/dev/null || true
  docker --version
fi

DIFY_DIR="${DIFY_DIR:-/opt/dify/docker}"
if [[ ! -f "$DIFY_DIR/docker-compose.yaml" && ! -f "$DIFY_DIR/docker-compose.yml" ]]; then
  echo "Dify compose not found at $DIFY_DIR"
  echo "Copy from NUC: rsync -avz ~/AI_HQ/dify/docker/ hetzner-motor:/opt/dify/docker/"
  echo "Or: git clone https://github.com/langgenius/dify.git /opt/dify && cd /opt/dify/docker"
  exit 2
fi

cd "$DIFY_DIR"
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example — EDIT SECRETS before production."
  else
    echo "Missing .env and .env.example in $DIFY_DIR"
    exit 3
  fi
fi

echo "== Starting Dify stack =="
docker compose pull -q 2>/dev/null || true
docker compose up -d

echo "== Containers =="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -25

echo ""
echo "Next: open firewall for 80/443 or use Cloudflare Tunnel."
echo "Test from NUC: curl -s -o /dev/null -w '%{http_code}\n' http://<host>:5001/console/api/setup"
