#!/bin/bash
# Start AI Motor tunnel
# Gebruik: bash ~/AI_HQ/scripts/start_tunnel.sh

set -a; source ~/AI_HQ/.env; set +a

# Check of domein geconfigureerd is:
if grep -q "JOUWDOMEIN" ~/.cloudflared/ai-motor-tunnel.yml; then
  echo "⚠️ Domein nog niet ingesteld"
  echo ""
  echo "Stappen:"
  echo "1. Koop domein via cloudflare.com/registrar"
  echo "2. cloudflared login"
  echo "3. cloudflared tunnel create ai-motor"
  echo "4. Pas ~/.cloudflared/ai-motor-tunnel.yml aan"
  echo "5. cloudflared tunnel route dns ai-motor ai-motor.JOUWDOMEIN.nl"
  echo "6. bash ~/AI_HQ/scripts/start_tunnel.sh"
  exit 0
fi

# Start permanente tunnel:
cloudflared tunnel run --config \
  ~/.cloudflared/ai-motor-tunnel.yml ai-motor
