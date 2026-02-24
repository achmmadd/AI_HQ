#!/usr/bin/env bash
# Omega AI-Holding — Grote controle: of alles echt werkt.
# Run: cd ~/AI_HQ && ./scripts/grote_controle_alles.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "  Omega AI-Holding — Grote controle"
echo "  $ROOT"
echo "=============================================="
echo ""

PASS=0
FAIL=0

check() {
    if eval "$@" >/dev/null 2>&1; then
        echo "  ✓ $1"
        PASS=$((PASS + 1))
        return 0
    else
        echo "  ✗ $1"
        FAIL=$((FAIL + 1))
        return 1
    fi
}

# ——— 1. Processen ———
echo "1. DAEMONS"
check "pgrep -f 'telegram_bridge.py' >/dev/null" && true || true
[ -f "$ROOT/heartbeat.py" ] && check "pgrep -f 'heartbeat.py' >/dev/null" && true || true
check "pgrep -f 'streamlit run' >/dev/null" && true || true
[ -f "$ROOT/scripts/engineer_daemon.py" ] && check "pgrep -f 'engineer_daemon' >/dev/null" && true || true
# Waarschuwing: meerdere heartbeats = oude instanties
HB_COUNT=$(pgrep -f "heartbeat.py" 2>/dev/null | wc -l)
if [ "$HB_COUNT" -gt 3 ]; then
    echo "  ⚠ Veel heartbeat-processen ($HB_COUNT). Opruimen: pkill -f heartbeat.py; ./launch_factory.sh"
fi
echo ""

# ——— 2. Poort & bestanden ———
echo "2. POORT & BESTANDEN"
check "lsof -i :8501 >/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q 8501"
check "[ -f .env ]"
check "[ -f telegram_bridge.py ]"
check "[ -f dashboard.py ]"
[ -f "$ROOT/heartbeat.py" ] && check "[ -f heartbeat.py ]"
[ -f "$ROOT/scripts/engineer_daemon.py" ] && check "[ -f scripts/engineer_daemon.py ]"
check "[ -f scripts/check_telegram_token_env.sh ]"
check "[ -d holding/marketing ]"
check "[ -d holding/app_studio ]"
check "[ -d holding/copy_center ]"
check "[ -d holding/finance ]"
[ -d "$ROOT/projects" ] && check "[ -d projects ]"
check "[ -d data/tasks ]"
check "[ -d logs ]"
echo ""

# ——— 3. Telegram-token ———
echo "3. TELEGRAM TOKEN"
if [ -f "scripts/check_telegram_token_env.sh" ]; then
    if ./scripts/check_telegram_token_env.sh 2>/dev/null; then
        echo "  ✓ Token OK"
        PASS=$((PASS + 1))
    else
        echo "  ✗ Token placeholder of leeg"
        FAIL=$((FAIL + 1))
    fi
else
    if grep -q "^TELEGRAM_BOT_TOKEN=.*[0-9].*:AA" .env 2>/dev/null && ! grep -q "xxx" .env 2>/dev/null; then
        echo "  ✓ TELEGRAM_BOT_TOKEN gezet (handmatig gecontroleerd)"
        PASS=$((PASS + 1))
    else
        echo "  ✗ Check .env TELEGRAM_BOT_TOKEN"
        FAIL=$((FAIL + 1))
    fi
fi
echo ""

# ——— 4. Python-syntax & imports ———
echo "4. PYTHON (syntax & imports)"
check "python3 -m py_compile telegram_bridge.py 2>/dev/null"
[ -f "$ROOT/heartbeat.py" ] && check "python3 -m py_compile heartbeat.py 2>/dev/null"
if [ -f dashboard.py ]; then
    check "python3 -m py_compile dashboard.py 2>/dev/null" || true
fi
# Optioneel: holding.config (telegram_bridge gebruikt dit)
if python3 -c "
import sys
sys.path.insert(0, \"$ROOT\")
__import__('holding.config')
" 2>/dev/null; then
    echo "  ✓ holding.config OK"
    PASS=$((PASS + 1))
else
    echo "  ○ holding.config (optioneel)"
fi
echo ""

# ——— 5. Logs (recente fouten) ———
echo "5. LOGS (laatste 24 uur)"
for log in logs/telegram_bridge.log logs/heartbeat.log logs/engineer.log; do
    if [ -f "$log" ]; then
        ERR=$(grep -c -i "error\|exception\|traceback\|syntaxerror" "$log" 2>/dev/null) || ERR=0
        if [ "$ERR" -gt 0 ]; then
            echo "  ⚠ $log: $ERR regel(s) met error (zie tail -20 $log)"
        else
            echo "  ✓ $log: geen recente errors in grep"
        fi
    else
        echo "  ○ $log: (nog niet aangemaakt)"
    fi
done
echo ""

# ——— 6. UFW (optioneel) ———
echo "6. FIREWALL (UFW)"
if command -v ufw >/dev/null 2>&1; then
    if ufw status 2>/dev/null | grep -q "Status: active"; then
        echo "  ✓ UFW actief"
        ufw status 2>/dev/null | grep -E "8501|22" | sed 's/^/    /'
    else
        echo "  ○ UFW niet actief (optioneel: sudo ./scripts/setup_security.sh)"
    fi
else
    echo "  ○ ufw niet geïnstalleerd"
fi
echo ""

# ——— 7. Telegram API (live test) ———
echo "7. TELEGRAM API (live)"
if [ -f .env ]; then
    set -a
    # shellcheck source=/dev/null
    source .env 2>/dev/null || true
    set +a
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [[ "$TELEGRAM_BOT_TOKEN" != *"xxx"* ]]; then
        if curl -s -o /dev/null -w "%{http_code}" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | grep -q 200; then
            echo "  ✓ getMe 200 — bot token geldig"
            PASS=$((PASS + 1))
        else
            echo "  ✗ getMe niet 200 — token ongeldig of netwerk"
            FAIL=$((FAIL + 1))
        fi
    else
        echo "  ○ Token niet gezet of placeholder; skip live test"
    fi
fi
echo ""

# ——— 8. Dashboard bereikbaar ———
echo "8. DASHBOARD (localhost:8501)"
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:8501 2>/dev/null | grep -qE "200|302"; then
    echo "  ✓ Dashboard reageert"
        PASS=$((PASS + 1))
else
    echo "  ✗ Geen antwoord op 127.0.0.1:8501"
        FAIL=$((FAIL + 1))
fi
echo ""

# ——— 9. 24/7 / overleeft sluiten terminal? ———
echo "9. 24/7 (draait na sluiten SSH/terminal?)"
BRIDGE_PID=$(pgrep -f "telegram_bridge.py" 2>/dev/null | head -1)
if [ -n "$BRIDGE_PID" ]; then
    BRIDGE_PPID=$(ps -o ppid= -p "$BRIDGE_PID" 2>/dev/null | tr -d ' ')
    PCOMM=$(ps -o comm= -p "$BRIDGE_PPID" 2>/dev/null || echo "")
    if [ "$BRIDGE_PPID" = "1" ] || [ "$PCOMM" = "systemd" ] || [ "$PCOMM" = "init" ]; then
        echo "  ✓ Daemons zijn kind van PID 1/systemd — blijven draaien na sluiten terminal"
        PASS=$((PASS + 1))
    else
        echo "  ⚠ Parent van bridge is $PCOMM (PID $BRIDGE_PPID) — bij sluiten terminal kunnen processen stoppen"
        echo "    Start 24/7: ./scripts/start_24_7.sh   of: systemctl --user start omega-holding.service"
    fi
else
    echo "  ○ Geen bridge-PID; skip 24/7-check"
fi
echo ""

# ——— Samenvatting ———
echo "=============================================="
echo "  Samenvatting: $PASS OK, $FAIL gefaald"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "  Acties:"
    echo "  - Geen menu/reactie: ./scripts/stop_bridge_and_restart.sh, daarna /start in Telegram"
    echo "  - Token: ./scripts/check_telegram_token_env.sh of bewerk .env"
    echo "  - Logs: tail -f logs/telegram_bridge.log"
    echo "  - 24/7 na sluiten terminal: ./scripts/start_24_7.sh of ./scripts/start_24_7.sh systemd"
    exit 1
fi
echo "  Alles in orde."
echo "  24/7: docs/24_7_RUN.md (./scripts/start_24_7.sh of systemd)"
exit 0
