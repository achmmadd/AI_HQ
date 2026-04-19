#!/usr/bin/env bash
# Na: cloudflared login (browser)
# Voer uit: bash ~/AI_HQ/scripts/setup_motorsai_tunnel.sh
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

if [[ ! -f "$HOME/.cloudflared/cert.pem" ]]; then
  echo "Geen ~/.cloudflared/cert.pem — eerst: cloudflared login"
  exit 1
fi

cd "$HOME/AI_HQ"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a

TUNNEL_NAME="motorsai"
if ! cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID="$(cloudflared tunnel list | grep "$TUNNEL_NAME" | head -1 | awk '{print $1}')"
if [[ -z "$TUNNEL_ID" || "$TUNNEL_ID" == ID ]]; then
  echo "Kon tunnel-ID niet vinden voor $TUNNEL_NAME"
  cloudflared tunnel list
  exit 1
fi

CRED="$HOME/.cloudflared/${TUNNEL_ID}.json"
if [[ ! -f "$CRED" ]]; then
  echo "Credentials ontbreken: $CRED"
  exit 1
fi

mkdir -p "$HOME/.cloudflared"
cat > "$HOME/.cloudflared/config.yml" << CFEOF
tunnel: $TUNNEL_ID
credentials-file: $CRED

ingress:
  - hostname: motorsai.app
    service: http://localhost:3040
  - hostname: www.motorsai.app
    service: http://localhost:3040
  - hostname: fumero.motorsai.app
    service: http://localhost:3040
  - hostname: bokas.motorsai.app
    service: http://localhost:3040
  - service: http_status:404
CFEOF

echo "✅ $HOME/.cloudflared/config.yml (tunnel $TUNNEL_ID)"

for h in motorsai.app www.motorsai.app fumero.motorsai.app bokas.motorsai.app; do
  cloudflared tunnel route dns "$TUNNEL_NAME" "$h" || true
done

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/ai-motor-tunnel.service" << SVCEOF
[Unit]
Description=motorsai.app — Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=$HOME/.local/bin/cloudflared tunnel run $TUNNEL_NAME
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
SVCEOF

systemctl --user daemon-reload
systemctl --user enable ai-motor-tunnel.service
systemctl --user restart ai-motor-tunnel.service || systemctl --user start ai-motor-tunnel.service

sleep 3
systemctl --user status ai-motor-tunnel.service --no-pager || true

ENVL="$HOME/AI_HQ/ai-motor/.env.local"
if grep -q '^NEXT_PUBLIC_APP_URL=' "$ENVL" 2>/dev/null; then
  sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://motorsai.app|' "$ENVL"
else
  echo 'NEXT_PUBLIC_APP_URL=https://motorsai.app' >> "$ENVL"
fi
if grep -q '^EMBED_FRAME_ANCESTORS=' "$ENVL" 2>/dev/null; then
  sed -i 's|^EMBED_FRAME_ANCESTORS=.*|EMBED_FRAME_ANCESTORS=https://motorsai.app,https://www.motorsai.app,https://fumero.motorsai.app,https://bokas.motorsai.app,https://fumero.nl,https://www.fumero.nl|' "$ENVL"
else
  echo 'EMBED_FRAME_ANCESTORS=https://motorsai.app,https://www.motorsai.app,https://fumero.motorsai.app,https://bokas.motorsai.app,https://fumero.nl,https://www.fumero.nl' >> "$ENVL"
fi

export PATH="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$PATH"
(cd "$HOME/AI_HQ/ai-motor" && npm rebuild better-sqlite3 && npm run build)
pm2 restart ai-motor --update-env
pm2 save

echo ""
echo "Test (DNS kan even duren):"
for url in "https://motorsai.app" "https://fumero.motorsai.app" "https://bokas.motorsai.app"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 15 || echo "000")
  echo "  $url → $code"
done

echo ""
echo "Klaar. Optioneel: Telegram handmatig sturen dat motorsai live is."
