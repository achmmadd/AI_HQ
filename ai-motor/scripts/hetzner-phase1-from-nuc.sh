#!/usr/bin/env bash
# Run on openclaw-nuc after SSH is configured.
set -euo pipefail

HETZNER_SSH="${HETZNER_SSH:-}"
DIFY_SRC="${DIFY_SRC:-$HOME/AI_HQ/dify/docker}"
REMOTE_DIFY_DIR="${REMOTE_DIFY_DIR:-/opt/dify/docker}"

if [[ -z "$HETZNER_SSH" ]]; then
  echo "Set HETZNER_SSH (e.g. hetzner-motor or root@<ipv4>) — see docs/hetzner-phase1.md"
  exit 1
fi

if [[ ! -d "$DIFY_SRC" ]]; then
  echo "Missing Dify docker dir: $DIFY_SRC"
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== SSH probe: $HETZNER_SSH =="
ssh -o BatchMode=yes -o ConnectTimeout=15 "$HETZNER_SSH" 'hostname; uname -a'

echo "== Rsync Dify docker/ (excl. volumes) =="
ssh "$HETZNER_SSH" "mkdir -p $REMOTE_DIFY_DIR"
rsync -avz --delete \
  --exclude '.env' \
  --exclude 'volumes/' \
  --exclude 'nginx/ssl/' \
  "$DIFY_SRC/" "$HETZNER_SSH:$REMOTE_DIFY_DIR/"

echo "== Remote bootstrap =="
ssh "$HETZNER_SSH" "DIFY_DIR=$REMOTE_DIFY_DIR bash -s" < "$SCRIPT_DIR/hetzner-bootstrap-remote.sh"

echo ""
echo "Done. Update ai-motor .env.local DIFY_BASE_URL + keys, then pm2 restart."
echo "See docs/hetzner-phase1.md"
