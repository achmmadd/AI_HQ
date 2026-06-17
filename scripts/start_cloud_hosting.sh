#!/usr/bin/env bash
# Start MotorsAI + Cloudflare tunnel (fallback when NUC is offline).
# Usage:
#   export TUNNEL_TOKEN='eyJ...'   # Cloudflare Zero Trust → Tunnels → motorsai → token
#   bash scripts/start_cloud_hosting.sh
#
# Without TUNNEL_TOKEN: only local http://127.0.0.1:3040 (menu.motorsai.app stays 530).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOTOR_DIR="$ROOT/ai-motor"
DATA_DIR="${AI_HQ_DATA:-$HOME/AI_HQ/data}"
LOG_DIR="$ROOT/logs"
CLOUDFLARED="${CLOUDFLARED_BIN:-/tmp/cloudflared}"

mkdir -p "$DATA_DIR" "$LOG_DIR"

export HOME="${HOME:-/home/ubuntu}"
export NODE_ENV="${NODE_ENV:-development}"

if [[ ! -f "$MOTOR_DIR/.env.local" ]]; then
  echo "⚠️  Geen $MOTOR_DIR/.env.local — kopieer .env.example of gebruik bestaande NUC backup."
fi

# Stop stale processes on 3040
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3040/tcp 2>/dev/null || true
fi

echo "=== MotorsAI op :3040 ==="
cd "$MOTOR_DIR"
if [[ "${MOTOR_MODE:-dev}" == "prod" ]]; then
  npm run build
  nohup npm run start >> "$LOG_DIR/ai-motor.log" 2>&1 &
else
  nohup npm run dev >> "$LOG_DIR/ai-motor.log" 2>&1 &
fi
MOTOR_PID=$!
echo "  ai-motor PID $MOTOR_PID (log: $LOG_DIR/ai-motor.log)"

echo "  Wachten op server..."
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3040/" --max-time 3 || echo "000")
  if [[ "$code" == "200" || "$code" == "307" ]]; then
    echo "  ✓ http://127.0.0.1:3040/ → $code"
    break
  fi
  sleep 2
done

if [[ -z "${TUNNEL_TOKEN:-}" ]]; then
  echo ""
  echo "⚠️  TUNNEL_TOKEN niet gezet — menu.motorsai.app blijft offline (Cloudflare 1033)."
  echo "  Zet token en herstart:"
  echo "    export TUNNEL_TOKEN='...'"
  echo "    bash scripts/start_cloud_hosting.sh"
  exit 0
fi

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "  cloudflared downloaden..."
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o "$CLOUDFLARED"
  chmod +x "$CLOUDFLARED"
fi

echo ""
echo "=== Cloudflare tunnel (menu.motorsai.app + motorsai.app) ==="
pkill -f "cloudflared tunnel run" 2>/dev/null || true
sleep 1
nohup "$CLOUDFLARED" tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" >> "$LOG_DIR/cloudflared.log" 2>&1 &
echo "  cloudflared PID $! (log: $LOG_DIR/cloudflared.log)"
echo ""
echo "  Test na ~30s:"
echo "    curl -sI https://menu.motorsai.app/"
echo "    curl -sI https://motorsai.app/"
