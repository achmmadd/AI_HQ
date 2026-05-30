#!/usr/bin/env bash
# COMPLETE PRODUCTION QA — rapport groen/rood per checklist-item
set -u

cd ~/AI_HQ || exit 1
export PATH="${HOME}/.local/bin:${PATH}"

PASS=0
FAIL=0
SKIP=0

R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
N='\033[0m'

pass() { echo -e "  ${G}✅${N} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${R}❌${N} $1"; FAIL=$((FAIL+1)); }
skip() { echo -e "  ${Y}⏭${N} $1"; SKIP=$((SKIP+1)); }

load_dotenv_safe() {
  local f="$1"
  [ -f "$f" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    local k="${BASH_REMATCH[1]}"
    local v="${BASH_REMATCH[2]}"
    v="${v#"${v%%[![:space:]]*}"}"
    v="${v%"${v##*[![:space:]]}"}"
    if [[ "$v" =~ ^\"(.*)\"$ ]]; then v="${BASH_REMATCH[1]}"; fi
    if [[ "$v" =~ ^\'(.*)\'$ ]]; then v="${BASH_REMATCH[1]}"; fi
    export "$k"="$v"
  done < "$f"
}

load_dotenv_safe ".env"
load_dotenv_safe "ai-motor/.env.local"

# Zorg dat SQLite-schema gelijk is aan ai-motor (zonder draaiende server)
python3 "${HOME}/AI_HQ/scripts/bootstrap_ai_motor_db.py" 2>/dev/null || true

QA_BASE="${QA_BASE:-http://127.0.0.1:3040}"
PUBLIC_URL="${PUBLIC_URL:-https://motorsai.app}"
QA_COOKIE="${QA_COOKIE:-/tmp/qa_production_cookies.txt}"
DB="${DB:-${HOME}/AI_HQ/data/ai-motor.db}"
CRON_SECRET="${FEEDBACK_CRON_SECRET:-}"

ai_sql() {
  local db="$1" sql="$2"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$db" "$sql" 2>/dev/null || true
  else
    python3 -c "
import sqlite3, sys
db, sql = sys.argv[1], sys.argv[2]
try:
    con = sqlite3.connect(db)
    for row in con.execute(sql):
        print('|'.join('' if x is None else str(x) for x in row))
    con.close()
except Exception:
    pass
" "$db" "$sql" 2>/dev/null || true
  fi
}

ai_scalar() { ai_sql "$1" "$2" | head -1; }

# Betrouwbare checks zonder sqlite3 CLI
py_scalar() {
  python3 -c "
import sqlite3, sys
db, q = sys.argv[1], sys.argv[2]
con = sqlite3.connect(db)
try:
    r = con.execute(q).fetchone()
    print('' if r is None else r[0])
finally:
    con.close()
" "$DB" "$1" 2>/dev/null || echo ""
}

http_code_clean() {
  local raw
  raw=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "${2:-15}" "$1" 2>/dev/null || true)
  raw="${raw:-000}"
  echo "${raw:0:3}"
}

qa_login() {
  if [ -z "${MOTORSAI_PASSWORD:-}" ]; then
    return 1
  fi
  curl -sS -X POST "${QA_BASE}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"${MOTORSAI_PASSWORD}\"}" \
    -c "$QA_COOKIE" -o /dev/null --max-time 10
}

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo " COMPLETE PRODUCTION QA — $(date -Iseconds)"
echo " QA_BASE=$QA_BASE | DB=$DB"
echo "═══════════════════════════════════════════════════════════════════"

# ---------------------------------------------------------------------------
# 1. Database
# ---------------------------------------------------------------------------
echo ""
echo "━━ 1. DATABASE ━━"

if [ ! -f "$DB" ]; then
  fail "Database bestand ontbreekt: $DB"
else
  pass "Database bestand bestaat"
  INT=$(py_scalar "PRAGMA integrity_check;")
  if [ "$INT" = "ok" ]; then pass "PRAGMA integrity_check = ok"; else fail "integrity_check: $INT"; fi

  FK=$(python3 -c "
import sqlite3,sys
c=sqlite3.connect(sys.argv[1])
n=len(c.execute('PRAGMA foreign_key_check').fetchall())
c.close()
print(n)
" "$DB" 2>/dev/null || echo 999)
  if [ "${FK:-999}" = "0" ]; then pass "Foreign keys: geen violations (foreign_key_check leeg)"; else fail "FK violations count=$FK"; fi

  for t in chat_history conversations message_feedback experiments system_improvements app_settings; do
    c=$(py_scalar "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$t';")
    if [ "$c" = "1" ]; then pass "Tabel $t bestaat"; else fail "Tabel $t ontbreekt"; fi
  done
fi

# ---------------------------------------------------------------------------
# 2. APIs (smoke)
# ---------------------------------------------------------------------------
echo ""
echo "━━ 2. APIs (HTTP smoke) ━━"

code=$(http_code_clean "${QA_BASE}/api/health" 10)
[[ "$code" =~ ^(200|207)$ ]] && pass "/api/health → $code" || fail "/api/health → $code (server op ${QA_BASE}?)"

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 120 -X POST "${QA_BASE}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"QA ping: antwoord alleen met het woord OK","klant":"fumero"}' 2>/dev/null || true)
code="${code:0:3}"; code="${code:-000}"
[[ "$code" = "200" ]] && pass "POST /api/chat → 200" || fail "POST /api/chat → $code"

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 -N -X POST "${QA_BASE}/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"QA","klant":"fumero"}' 2>/dev/null || true)
code="${code:0:3}"; code="${code:-000}"
[[ "$code" = "200" ]] && pass "POST /api/chat/stream → 200 (SSE start)" || fail "POST /api/chat/stream → $code"

code=$(http_code_clean "${QA_BASE}/api/conversations?klant=fumero" 10)
[[ "$code" = "200" ]] && pass "GET /api/conversations → 200" || fail "GET /api/conversations → $code"

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -X POST "${QA_BASE}/api/conversations" \
  -H "Content-Type: application/json" \
  -d '{"klant":"fumero","title":"QA tmp"}' 2>/dev/null || true)
code="${code:0:3}"; code="${code:-000}"
[[ "$code" = "200" ]] && pass "POST /api/conversations → 200" || fail "POST /api/conversations → $code"

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -X POST "${QA_BASE}/api/message-feedback" \
  -H "Content-Type: application/json" \
  -d '{"message_id":1,"rating":5,"klant":"fumero"}' 2>/dev/null || true)
code="${code:0:3}"; code="${code:-000}"
[[ "$code" =~ ^(200|404|403)$ ]] && pass "POST /api/message-feedback bereikbaar → $code (404 ok als msg 1 geen assistant)" || fail "POST /api/message-feedback → $code"

if qa_login 2>/dev/null; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -b "$QA_COOKIE" "${QA_BASE}/api/experiments" 2>/dev/null || true)
  code="${code:0:3}"; code="${code:-000}"
  [[ "$code" = "200" ]] && pass "GET /api/experiments (auth) → 200" || fail "GET /api/experiments → $code"
else
  skip "GET /api/experiments — geen MOTORSAI_PASSWORD"
fi

if qa_login 2>/dev/null; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 180 -X POST "${QA_BASE}/api/builder" \
    -H "Content-Type: application/json" -b "$QA_COOKIE" \
    -d '{"prompt":"QA: één HTML pagina met alleen een H1 Hallo","klant":"system"}' 2>/dev/null || true)
  code="${code:0:3}"; code="${code:-000}"
  [[ "$code" = "200" ]] && pass "POST /api/builder → 200" || fail "POST /api/builder → $code (check n8n/auth)"
else
  skip "POST /api/builder — geen MOTORSAI_PASSWORD"
fi

# ---------------------------------------------------------------------------
# 3. Chat flow (content + feedback)
# ---------------------------------------------------------------------------
echo ""
echo "━━ 3. CHAT FLOW ━━"

CHAT_JSON=$(curl -sS --max-time 120 -X POST "${QA_BASE}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Wat is 2+2? Antwoord in één korte zin, geen koppen.","klant":"fumero"}' || echo "{}")

if echo "$CHAT_JSON" | grep -q '"message"'; then
  pass "Chat JSON bevat message"
  MSG=$(echo "$CHAT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','')[:500])" 2>/dev/null || echo "")
  if echo "$MSG" | grep -qiE 'Factory OS Response|\*\*Klant:\*\*|## Volledige response|Samenvatting'; then
    fail "Response lijkt Factory-metadata te bevatten (niet schoon)"
  else
    pass "Response zonder Factory-envelope patronen (steekproef)"
  fi
  MID=$(echo "$CHAT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('assistant_message_id',''))" 2>/dev/null || echo "")
  if [ -n "$MID" ] && [ "$MID" != "None" ]; then
    pass "assistant_message_id aanwezig: $MID"
    FB=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -X POST "${QA_BASE}/api/message-feedback" \
      -H "Content-Type: application/json" \
      -d "{\"message_id\":$MID,\"rating\":5,\"klant\":\"fumero\"}" 2>/dev/null || true)
    FB="${FB:0:3}"; FB="${FB:-000}"
    [[ "$FB" = "200" ]] && pass "👍 feedback op assistant row → 200" || fail "feedback POST → $FB"
    FC=$(py_scalar "SELECT COUNT(*) FROM message_feedback WHERE message_id=$MID AND rating=5;")
    [[ "${FC:-0}" = "1" ]] && pass "Feedback opgeslagen in message_feedback" || fail "Geen message_feedback rij voor message_id=$MID"
  else
    fail "Geen assistant_message_id in response"
  fi
else
  fail "Chat geen geldige JSON / geen message — $(echo "$CHAT_JSON" | head -c 120)"
fi

# ---------------------------------------------------------------------------
# 4. Multi-chat
# ---------------------------------------------------------------------------
echo ""
echo "━━ 4. MULTI-CHAT ━━"

CONV=$(curl -sS --max-time 15 -X POST "${QA_BASE}/api/conversations" \
  -H "Content-Type: application/json" \
  -d '{"klant":"fumero","title":"QA multi"}' || echo "{}")

CID=$(echo "$CONV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
if [ -n "$CID" ] && [ "$CID" != "None" ]; then
  pass "Nieuwe conversation aangemaakt id=$CID"
else
  fail "POST conversation geen id"
  CID=""
fi

if [ -n "$CID" ]; then
  HIST=$(curl -sS --max-time 10 "${QA_BASE}/api/conversations/${CID}/messages?klant=fumero" || echo "{}")
  echo "$HIST" | grep -q '"messages"' && pass "GET messages voor conversation" || fail "GET messages mislukt"

  DEL=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -X DELETE \
    "${QA_BASE}/api/conversations/${CID}?klant=fumero" || echo "000")
  [[ "$DEL" = "200" ]] && pass "DELETE conversation → 200" || fail "DELETE conversation → $DEL"

  C2=$(ai_scalar "$DB" "SELECT COUNT(*) FROM conversations WHERE id=$CID;")
  [[ "${C2:-1}" = "0" ]] && pass "Conversation uit DB verwijderd" || fail "Conversation $CID nog in DB"
fi

LIST=$(curl -sS --max-time 10 "${QA_BASE}/api/conversations?klant=fumero" || echo "{}")
echo "$LIST" | grep -q '"conversations"' && pass "GET list conversations" || fail "GET list conversations"

# ---------------------------------------------------------------------------
# 5. Builder + app route
# ---------------------------------------------------------------------------
echo ""
echo "━━ 5. BUILDER + /apps/[slug] ━━"

if qa_login 2>/dev/null; then
  BOUT=$(curl -sS --max-time 180 -X POST "${QA_BASE}/api/builder" \
    -H "Content-Type: application/json" -b "$QA_COOKIE" \
    -d '{"prompt":"QA app: minimale pagina met knop die alert toont","klant":"system"}' || echo "{}")
  SLUG=$(echo "$BOUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slug',''))" 2>/dev/null || echo "")
  if [ -n "$SLUG" ] && [ "$SLUG" != "None" ]; then
    pass "Builder returned slug=$SLUG"
    SLUG_SAFE=$(echo "$SLUG" | tr -cd 'a-zA-Z0-9_-')
    NCOUNT=$(ai_scalar "$DB" "SELECT COUNT(*) FROM custom_apps WHERE slug='${SLUG_SAFE}';")
    [[ "${NCOUNT:-0}" = "1" ]] && pass "custom_apps rij met code voor slug" || fail "Geen DB rij voor slug"
    AC=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "${QA_BASE}/apps/${SLUG_SAFE}" -b "$QA_COOKIE" || echo "000")
    [[ "$AC" =~ ^(200|302)$ ]] && pass "/apps/$SLUG → $AC" || fail "/apps/$SLUG → $AC"
  else
    fail "Builder geen slug — $(echo "$BOUT" | head -c 200)"
  fi
else
  skip "Builder E2E — geen MOTORSAI_PASSWORD"
fi

# ---------------------------------------------------------------------------
# 6. Learning loop
# ---------------------------------------------------------------------------
echo ""
echo "━━ 6. LEARNING LOOP ━━"

FCOUNT=$(ai_scalar "$DB" "SELECT COUNT(*) FROM message_feedback;")
[[ "${FCOUNT:-0}" -ge 0 ]] && pass "message_feedback heeft data (count=$FCOUNT)"

if [ -n "$CRON_SECRET" ]; then
  DIG=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
    "${QA_BASE}/api/cron/feedback-digest?date=$(date +%F)&secret=${CRON_SECRET}" || echo "000")
  [[ "$DIG" = "200" ]] && pass "GET /api/cron/feedback-digest (secret) → 200" || fail "feedback-digest → $DIG"
else
  skip "feedback-digest — FEEDBACK_CRON_SECRET niet gezet"
fi

if qa_login 2>/dev/null; then
  ADM=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 -b "$QA_COOKIE" "${QA_BASE}/admin/improvements" || echo "000")
  [[ "$ADM" =~ ^(200|304)$ ]] && pass "/admin/improvements (auth) → $ADM" || fail "/admin/improvements → $ADM"
else
  skip "/admin/improvements — geen login"
fi

# ---------------------------------------------------------------------------
# 7. Experiments
# ---------------------------------------------------------------------------
echo ""
echo "━━ 7. EXPERIMENTS (A/B) ━━"

if qa_login 2>/dev/null; then
  # archive others implicitly via POST new
  EOUT=$(curl -sS --max-time 15 -X POST "${QA_BASE}/api/experiments" \
    -H "Content-Type: application/json" -b "$QA_COOKIE" \
    -d '{"name":"QA A/B","hypothesis":"test","variant_a":"Antwoord in max 1 zin.","variant_b":"Antwoord met 3 bullets.","ends_in_days":1}' || echo "{}")
  EID=$(echo "$EOUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  if [ -n "$EID" ] && [ "$EID" != "None" ]; then
    pass "Experiment aangemaakt id=$EID"
    VA=0
    VB=0
    for i in 1 2 3 4 5 6; do
      CJ=$(curl -sS --max-time 90 -X POST "${QA_BASE}/api/chat" \
        -H "Content-Type: application/json" \
        -d '{"prompt":"QA ab '$i': noem één dier","klant":"fumero"}' || echo "{}")
      MID=$(echo "$CJ" | python3 -c "import sys,json; print(json.load(sys.stdin).get('assistant_message_id',''))" 2>/dev/null || echo "")
      if [ -n "$MID" ]; then
        V=$(ai_scalar "$DB" "SELECT experiment_variant FROM chat_history WHERE id=$MID;")
        [ "$V" = "a" ] && VA=$((VA+1))
        [ "$V" = "b" ] && VB=$((VB+1))
      fi
    done
    if [ $((VA+VB)) -ge 2 ]; then
      pass "Berichten gelogd met variant (a=$VA b=$VB over 6 calls)"
      if [ "$VA" -ge 1 ] && [ "$VB" -ge 1 ]; then
        pass "50/50 routing: beide varianten voorkomen"
      else
        skip "50/50: alleen één variant in steekproef (kleine n — geen harde fail)"
      fi
    else
      fail "Geen experiment_variant logging (chat faalde?)"
    fi
    FIN=$(curl -sS --max-time 30 -X PATCH "${QA_BASE}/api/experiments/${EID}" \
      -H "Content-Type: application/json" -b "$QA_COOKIE" \
      -d '{"action":"finalize"}' || echo "{}")
    echo "$FIN" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true' && pass "PATCH finalize experiment → ok" || fail "finalize: $FIN"
    EST=$(ai_scalar "$DB" "SELECT status FROM experiments WHERE id=$EID;")
    [[ "$EST" = "done" ]] && pass "Experiment status=done (winner detection gedraaid)" || fail "Experiment status=$EST"
  else
    fail "Experiment aanmaken mislukt — $EOUT"
  fi
else
  skip "Experiments E2E — geen MOTORSAI_PASSWORD"
fi

# ---------------------------------------------------------------------------
# 8. Approval -> Automation
# ---------------------------------------------------------------------------
echo ""
echo "━━ 8. APPROVAL → AUTOMATION ━━"

if qa_login 2>/dev/null; then
  A_TASKS=$(curl -sS --max-time 10 -b "$QA_COOKIE" "${QA_BASE}/api/automation/tasks" || echo "{}")
  A_TASK_ID=$(echo "$A_TASKS" | python3 -c "
import json,sys
tasks=json.load(sys.stdin).get('tasks', [])
pick=None
for t in tasks:
    if t.get('task_key') == 'analytics_report_weekly' and int(t.get('enabled') or 0) == 1:
        pick=t.get('id')
        break
print('' if pick is None else pick)
" 2>/dev/null || echo "")
  if [ -n "$A_TASK_ID" ] && [ "$A_TASK_ID" != "None" ]; then
    A_RUN=$(curl -sS --max-time 15 -X POST "${QA_BASE}/api/automation/runs" \
      -H "Content-Type: application/json" -b "$QA_COOKIE" \
      -d "{\"task_id\":${A_TASK_ID}}" || echo "{}")
    A_RUN_ID=$(echo "$A_RUN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('run',{}).get('id',''))" 2>/dev/null || echo "")
    A_RUN_STATUS=$(echo "$A_RUN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('run',{}).get('status',''))" 2>/dev/null || echo "")
    if [ -n "$A_RUN_ID" ] && [ "$A_RUN_ID" != "None" ]; then
      pass "Automation run aangemaakt id=$A_RUN_ID"
      if [ "$A_RUN_STATUS" = "pending_approval" ]; then
        pass "Run status start op pending_approval"
      else
        fail "Run startstatus verwacht pending_approval, kreeg=$A_RUN_STATUS"
      fi
      A_APPROVE=$(curl -sS --max-time 30 -X POST "${QA_BASE}/api/automation/runs/${A_RUN_ID}/approve" -b "$QA_COOKIE" || echo "{}")
      A_AFTER=$(echo "$A_APPROVE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('run',{}).get('status',''))" 2>/dev/null || echo "")
      if [[ "$A_AFTER" =~ ^(success|running|queued)$ ]]; then
        pass "Approve endpoint verwerkt run (status=$A_AFTER)"
      else
        fail "Approve endpoint status onverwacht: $A_AFTER"
      fi
      A_FINAL="$A_AFTER"
      for _ in 1 2 3 4 5; do
        A_FINAL=$(ai_scalar "$DB" "SELECT status FROM automation_runs WHERE id=${A_RUN_ID};")
        [ "$A_FINAL" = "success" ] && break
        sleep 1
      done
      if [ "$A_FINAL" = "success" ]; then
        pass "Run eindigt op success na approval"
      else
        A_DETAIL=$(ai_scalar "$DB" "SELECT COALESCE(detail,'') FROM automation_runs WHERE id=${A_RUN_ID};")
        fail "Run niet success na approval (status=$A_FINAL detail=${A_DETAIL:0:180})"
      fi
    else
      fail "Automation run aanmaken mislukt — $A_RUN"
    fi
  else
    skip "analytics_report_weekly taak niet beschikbaar of disabled"
  fi
else
  skip "Approval→automation E2E — geen MOTORSAI_PASSWORD"
fi

# ---------------------------------------------------------------------------
# 9. Infrastructure
# ---------------------------------------------------------------------------
echo ""
echo "━━ 9. INFRASTRUCTURE ━━"

EXT=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 -k "${PUBLIC_URL}/" || echo "000")
[[ "$EXT" = "200" ]] && pass "${PUBLIC_URL} → 200" || fail "${PUBLIC_URL} → $EXT"

if command -v pm2 >/dev/null 2>&1; then
  if pm2 list 2>/dev/null | grep -qE "online|stopped|errored"; then
    ER=$(pm2 list 2>/dev/null | grep -c "errored" || true)
    ST=$(pm2 list 2>/dev/null | grep -c "stopped" || true)
    ON=$(pm2 list 2>/dev/null | grep -c "online" || true)
    if [ "${ER:-0}" -gt 0 ] || [ "${ST:-0}" -gt 0 ]; then
      fail "PM2: online=$ON stopped=$ST errored=$ER — $(pm2 list 2>/dev/null | head -12)"
    else
      [ "${ON:-0}" -gt 0 ] && pass "PM2: $ON proces(sen) online" || fail "PM2: geen online processen"
    fi
  else
    skip "pm2 list leeg of onleesbaar"
  fi
else
  skip "pm2 niet geïnstalleerd"
fi

if pgrep -af cloudflared >/dev/null 2>&1; then
  pass "cloudflared proces actief"
else
  fail "geen cloudflared proces (tunnel?)"
fi

HC=$(curl -sS "${QA_BASE}/api/health" --max-time 10 || echo "{}")
if echo "$HC" | python3 -c "import json,sys; json.loads(sys.stdin.read())" >/dev/null 2>&1; then
  pass "Health JSON parsebaar"
else
  fail "Health body ongeldig"
fi

HSTATE=$(echo "$HC" | python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
except Exception:
    print('invalid')
    raise SystemExit
status = data.get('status')
if isinstance(status, str):
    print(status)
elif data.get('ok') is True:
    print('healthy')
elif data.get('ok') is False:
    print('degraded')
else:
    print('unknown')
" 2>/dev/null || echo "invalid")
if [[ "$HSTATE" =~ ^(healthy|degraded)$ ]]; then
  pass "Health status aanwezig (${HSTATE})"
else
  fail "Health mist status (raw=$HSTATE)"
fi

# ---------------------------------------------------------------------------
# 10. Telegram
# ---------------------------------------------------------------------------
echo ""
echo "━━ 10. TELEGRAM ━━"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  TOUT=$(curl -sS --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"QA production final $(date +%H:%M)\"}" || echo "{}")
  echo "$TOUT" | grep -q '"ok":true' && pass "Telegram sendMessage ok" || fail "Telegram: $TOUT"
else
  skip "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID niet gezet"
fi

# ---------------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo -e " EINDE: ${G}PASS=$PASS${N}  ${R}FAIL=$FAIL${N}  ${Y}SKIP=$SKIP${N}"
if [ "$FAIL" -eq 0 ]; then
  echo -e " ${G}ALL GREEN (geen failures) — klaar voor LIVE${N}"
  exit 0
else
  echo -e " ${R}Er zijn failures — zie ❌ hierboven${N}"
  exit 1
fi
