#!/usr/bin/env bash
# Omega Holding — stop alle door launch_factory gestarte processen (niet Zwartehand).
# Gebruikt door: systemd ExecStop (omega-holding.service).
# Handmatig: ./scripts/stop_holding.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Omega-bridge stoppen (niet Zwartehand)
for pid in $(pgrep -f "telegram_bridge.py" 2>/dev/null); do
  args=$(ps -p "$pid" -o args= 2>/dev/null)
  if echo "$args" | grep -q "\-\-zwartehand"; then
    :  # Zwartehand laten draaien
  else
    kill "$pid" 2>/dev/null || true
  fi
done

# Heartbeat, Streamlit, Engineer
pkill -f "heartbeat.py" 2>/dev/null || true
pkill -f "streamlit run" 2>/dev/null || true
pkill -f "engineer_daemon" 2>/dev/null || true

# Korte pauze zodat processen netjes afsluiten
sleep 2
exit 0
