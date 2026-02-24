#!/usr/bin/env bash
# Omega AI-Holding — Start zo dat het 24/7 blijft draaien na sluiten SSH/terminal.
# Run: cd ~/AI_HQ && ./scripts/start_24_7.sh
# Optie: ./scripts/start_24_7.sh systemd   → gebruik systemd (aanbevolen)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$1" = "systemd" ]; then
    echo "=== Start via systemd (user service) ==="
    if systemctl --user is-active omega-holding.service >/dev/null 2>&1; then
        echo "  omega-holding.service draait al."
    else
        systemctl --user start omega-holding.service
        echo "  ✓ omega-holding.service gestart. Blijft draaien na sluiten terminal."
    fi
    echo "  Opstarten bij inloggen: systemctl --user enable omega-holding.service"
    echo "  24/7 ook zonder inloggen: loginctl enable-linger $USER  (eenmalig)"
    exit 0
fi

# Geen systemd: volledig losgekoppeld starten (nohup + subshell die meteen eindigt)
echo "=== Start 24/7 (nohup, overleeft sluiten terminal) ==="
# launch_factory.sh doet zelf pkill + sleep 3 + start; wij wachten tot alles draait
mkdir -p "$ROOT/logs"
nohup bash -c "cd '$ROOT' && ./launch_factory.sh" >> "$ROOT/logs/launch.log" 2>&1 &
disown 2>/dev/null || true
echo "  Wachten tot daemons opstarten (10 s)..."
sleep 10
if pgrep -f "telegram_bridge.py" >/dev/null; then
    echo "  ✓ Daemons gestart. Je kunt SSH/terminal nu sluiten; ze blijven draaien."
else
    echo "  ⚠ Bridge nog niet zichtbaar. Log: tail -30 $ROOT/logs/launch.log"
    echo "  Als je net handmatig launch_factory.sh had gedraaid: die draait al; sluit terminal en gebruik volgende keer: ./scripts/start_24_7.sh systemd"
fi
echo ""
echo "  Aanbevolen voor echte 24/7: ./scripts/start_24_7.sh systemd"
echo "  Controle: ./scripts/grote_controle_alles.sh"
