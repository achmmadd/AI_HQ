#!/usr/bin/env bash
# Omega AI-Holding — Zelfsturende infrastructuur
# Start Telegram Bridge, Heartbeat, Dashboard, Engineer als achtergrondprocessen.
# Gebruik: ./launch_factory.sh
# 24/7: ./scripts/start_24_7.sh systemd   of   nohup ./launch_factory.sh >> logs/launch.log 2>&1 & disown

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

mkdir -p logs data/tasks data/notes holding/data holding/output holding/marketing holding/marketing/data holding/app_studio holding/copy_center holding/finance holding/memory holding/swarm mcp
chmod -R 777 ./holding/data ./holding/output 2>/dev/null || true

# Venv
if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
  echo "  ✓ venv active"
else
  echo "  ⚠ Geen venv gevonden; gebruik system Python."
fi

# Playwright (optioneel)
if python3 -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
  echo "  ✓ Playwright beschikbaar"
else
  echo "  ⚠ Playwright niet geïnstalleerd (optioneel)."
fi

# .env
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  source .env 2>/dev/null || true
  set +a
  echo "  ✓ .env geladen"
else
  echo "  ⚠ Geen .env — run: ./scripts/create_env_if_missing.sh"
fi
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "  ⚠ TELEGRAM_BOT_TOKEN niet gezet — Telegram Bridge start niet."
else
  echo "  ✓ TELEGRAM_BOT_TOKEN aanwezig"
fi
# 1Panel API (optioneel; voor Jarvis/metrics)
if [ -f ".env.1panel" ]; then
  set -a
  # shellcheck source=/dev/null
  source .env.1panel 2>/dev/null || true
  set +a
  echo "  ✓ .env.1panel geladen (1Panel API)"
fi

# Vrijmaken poort 8501
if command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti:8501 2>/dev/null) || true
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    echo "  Poort 8501 vrijgemaakt"
  fi
fi

# ——— Telegram Bridge (Omega) ———  (Zwartehand niet stoppen)
# Belangrijk: Omega mag maar op ÉÉN plek draaien (NUC of laptop). Anders: Conflict getUpdates.
for pid in $(pgrep -f "telegram_bridge.py" 2>/dev/null); do
  args=$(ps -p "$pid" -o args= 2>/dev/null)
  if echo "$args" | grep -q "\-\-zwartehand"; then
    :  # laat Zwartehand draaien
  else
    kill "$pid" 2>/dev/null || true
  fi
done
# Wacht tot Telegram de oude polling-verbinding heeft vrijgegeven (voorkomt Conflict)
sleep 5
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  nohup python3 "$ROOT/telegram_bridge.py" >> "$ROOT/logs/telegram_bridge.log" 2>&1 &
  echo "  ✓ Telegram Bridge Omega (daemon)"
  disown 2>/dev/null || true
else
  echo "  ⚠ Telegram Bridge niet gestart (zet TELEGRAM_BOT_TOKEN in .env)"
fi

# ——— Heartbeat ———
if [ -f "heartbeat.py" ]; then
  nohup python3 heartbeat.py >> logs/heartbeat.log 2>&1 &
  echo "  ✓ Heartbeat (daemon)"
  disown 2>/dev/null || true
fi

# ——— Dashboard ———
if [ -f "dashboard.py" ] || [ -f "streamlit_app.py" ]; then
  APP="dashboard.py"
  [ -f "streamlit_app.py" ] && APP="streamlit_app.py"
  nohup streamlit run "$APP" --server.port 8501 --server.headless true >> logs/streamlit.log 2>&1 &
  echo "  ✓ Dashboard (daemon) http://localhost:8501"
  disown 2>/dev/null || true
fi

# ——— Engineer (auto-repair + lockdown) ———
if [ -f "scripts/engineer_daemon.py" ]; then
  nohup python3 "$ROOT/scripts/engineer_daemon.py" >> "$ROOT/logs/engineer.log" 2>&1 &
  echo "  ✓ Engineer (auto-repair + lockdown daemon)"
  disown 2>/dev/null || true
fi

# ——— Resource Warden (NUC temp/load → pause BU's bij overbelasting) ———
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx omega-resource-warden; then
  echo "  ↷ Resource Warden draait al in Docker (omega-resource-warden)"
elif [ -f "resource_warden.py" ]; then
  nohup python3 "$ROOT/resource_warden.py" >> "$ROOT/logs/resource_warden.log" 2>&1 &
  echo "  ✓ Resource Warden (system caretaker)"
  disown 2>/dev/null || true
fi

# ——— Agent Workers (Jarvis: voeren missies uit, schrijven rapport naar holding/output) ———
if [ -f "$ROOT/scripts/agent_workers.py" ]; then
  nohup python3 "$ROOT/scripts/agent_workers.py" >> "$ROOT/logs/agent_workers.log" 2>&1 &
  echo "  ✓ Agent Workers (rapporten → holding/output)"
  disown 2>/dev/null || true
fi

echo ""
echo "  Alle daemons gestart. Logs: logs/telegram_bridge.log, logs/heartbeat.log, logs/streamlit.log, logs/engineer.log, logs/resource_warden.log, logs/agent_workers.log"
echo "  Stop: pkill -f telegram_bridge.py; pkill -f heartbeat.py; pkill -f 'streamlit run'; pkill -f engineer_daemon; pkill -f resource_warden; pkill -f agent_workers"
if [ -n "$TUNNEL_TOKEN" ]; then
  echo ""
  echo "  🌐 Cloudflare Tunnel: TUNNEL_TOKEN aanwezig. Voor wereldwijd bereik:"
  echo "     → Zie docs/HANDSHAKE.md: in Cloudflare Dashboard → Public Hostname toevoegen"
  echo "     → Bijv. hq.jouwdomein.nl → HTTP → omega-dashboard:8501 (of localhost:8501 als tunnel op host draait)"
fi
echo ""
