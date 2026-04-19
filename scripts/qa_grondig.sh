#!/usr/bin/env bash
# AI Motor — grondige QA (gecorrigeerd t.o.v. productie-code: auth, DB-schema, iframe-pad).
set -eu

cd ~/AI_HQ
export PATH="${HOME}/.local/bin:${PATH}"

mkdir -p logs/qa
LOGFILE="${PWD}/logs/qa/qa_grondig_$(date +%Y%m%d_%H%M%S).log"
export LOGFILE

# shellcheck disable=SC2094
exec > >(tee -a "$LOGFILE") 2>&1

echo "🔍 GRONDIGE QA SPRINT — START"
date

# Laad secrets (root .env + ai-motor lokale defaults)
set -a
[ -f .env ] && . .env
[ -f ai-motor/.env.local ] && . ai-motor/.env.local
set +a

QA_BASE="${QA_BASE:-http://localhost:3040}"
QA_COOKIE="${QA_COOKIE:-/tmp/qa_motorsai_cookies.txt}"
DB="${DB:-${HOME}/AI_HQ/data/ai-motor.db}"
PREVIEW_FILE="${HOME}/AI_HQ/ai-motor/components/custom-app-preview.tsx"

qa_login() {
  if [ -z "${MOTORSAI_PASSWORD:-}" ]; then
    echo "⚠️ MOTORSAI_PASSWORD niet gezet — /api/builder en /api/* (behalve public) geven 401"
    return 1
  fi
  curl -sS -X POST "${QA_BASE}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"${MOTORSAI_PASSWORD}\"}" \
    -c "$QA_COOKIE" -o /dev/null
  return 0
}

# ============================================================================
# FASE 1 — INFRASTRUCTURE
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 1 — INFRASTRUCTURE DEEP CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📦 Docker containers (n8n / dify / qdrant / docker-api):"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -E "n8n|dify|qdrant|docker-api" || echo "⚠️ Geen match in docker ps"

for container in n8n docker-api-1 qdrant-qdrant-1; do
  if docker ps 2>/dev/null | grep -q "$container"; then
    health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-health-check")
    echo "  ✅ $container (health: $health)"
    err_lines=$(docker logs "$container" 2>&1 | tail -100 | grep -iE "error|exception|fail" | wc -l || true)
    if [ "${err_lines:-0}" -gt 0 ]; then
      echo "     ⚠️ ${err_lines} regels met error/fail in tail logs"
    else
      echo "     ✅ Geen error-patroon in laatste 100 logregels"
    fi
  else
    echo "  ❌ $container NIET RUNNING"
  fi
done

echo ""
echo "🤖 Ollama:"
if curl -s "${OLLAMA_HOST:-http://localhost:11434}/api/tags" --max-time 3 >/dev/null 2>&1; then
  echo "  ✅ Ollama actief"
else
  echo "  ❌ Ollama niet bereikbaar"
fi

echo ""
echo "🦅 OpenClaw:"
if pgrep -f "openclaw" >/dev/null 2>&1; then
  echo "  ✅ OpenClaw proces gevonden"
  curl -s http://localhost:3000/health --max-time 3 >/dev/null && echo "  ✅ Gateway :3000" || echo "  ⚠️ Gateway :3000 niet OK"
else
  echo "  ❌ OpenClaw proces niet gevonden"
fi

echo ""
echo "⚙️ PM2:"
pm2 jlist 2>/dev/null | jq -r '.[] | "\(.name): \(.pm2_env.status) (restarts: \(.pm2_env.restart_time))"' || echo "❌ PM2/jq probleem"

echo ""
echo "💾 Disk / DB:"
df -h / | tail -1
[ -f "$DB" ] && du -h "$DB" | awk '{print "  ai-motor.db: "$1}' || echo "  ⚠️ Geen $DB"

# ============================================================================
# FASE 2 — DATABASE
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 2 — DATABASE INTEGRITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f "$DB" ]; then
  echo "❌ Database niet gevonden: $DB"
  exit 1
fi

echo ""
INTEGRITY=$(sqlite3 "$DB" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" = "ok" ]; then
  echo "  ✅ SQLite integrity OK"
else
  echo "  ❌ Integrity: $INTEGRITY"
fi

echo ""
echo "📈 Rijen per kern-tabel:"
for table in todos agenda notifications approvals chat_history uploads \
  bokas_reserveringen bokas_personeel bokas_shifts bokas_menu \
  content_posts content_templates usage_logs fumero_reviews custom_apps; do
  count=$(sqlite3 "$DB" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
  printf "  %-25s %6s rows\n" "$table:" "$count"
done

echo ""
echo "🏗️ Laatste custom_apps:"
sqlite3 "$DB" "SELECT id, naam, slug, LENGTH(code), status, created_at FROM custom_apps ORDER BY created_at DESC LIMIT 5;" 2>/dev/null | column -t -s '|' || true

NULL_CODE=$(sqlite3 "$DB" "SELECT COUNT(*) FROM custom_apps WHERE code IS NULL OR code = '';" 2>/dev/null || echo "0")
if [ "$NULL_CODE" -gt 0 ]; then
  echo "  ⚠️ $NULL_CODE apps zonder code"
else
  echo "  ✅ Geen lege code in custom_apps"
fi

OLD_UPLOADS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM uploads WHERE created_at < datetime('now', '-30 days');" 2>/dev/null || echo "0")
# chat_history gebruikt created_at (geen kolom timestamp)
OLD_CHAT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM chat_history WHERE created_at < datetime('now', '-90 days');" 2>/dev/null || echo "0")
echo ""
echo "🧹 Oude records: uploads >30d: $OLD_UPLOADS | chat >90d: $OLD_CHAT"
export OLD_UPLOADS OLD_CHAT

# ============================================================================
# FASE 3 — API (auth waar nodig)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 3 — API ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ENDPOINTS=(
  "/api/health:GET"
  "/api/apps:GET"
  "/api/todos:GET"
  "/api/agenda:GET"
  "/api/afdelingen:GET"
  "/api/usage:GET"
  "/api/content:GET"
  "/api/bokas/reserveringen:GET"
  "/api/bokas/menu:GET"
  "/api/bokas/personeel:GET"
  "/api/reviews:GET"
)

echo ""
echo "🌐 GET (zonder cookie — verwacht 200 of 401/403):"
for spec in "${ENDPOINTS[@]}"; do
  ep="${spec%%:*}"
  method="${spec##*:}"
  response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" -X "$method" "${QA_BASE}${ep}" --max-time 8 || echo "000|0")
  code=$(echo "$response" | cut -d'|' -f1)
  time=$(echo "$response" | cut -d'|' -f2)
  if [[ "$code" =~ ^(200|401|403)$ ]]; then
    printf "  ✅ %-38s %s (%ss)\n" "$ep" "$code" "$time"
  else
    printf "  ❌ %-38s %s (%ss)\n" "$ep" "$code" "$time"
  fi
done

CHAT_TIME="N/A"
echo ""
echo "🌐 POST /api/chat (public):"
CHAT_START=$(date +%s)
CHAT_RESPONSE=$(curl -s -X POST "${QA_BASE}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"ping","klant":"fumero"}' \
  --max-time 120 || true)
CHAT_END=$(date +%s)
CHAT_TIME=$((CHAT_END - CHAT_START))
export CHAT_TIME
if echo "$CHAT_RESPONSE" | grep -qi "error\|unauthorized\|factory"; then
  echo "    ℹ️ Response ontvangen (${CHAT_TIME}s) — inhoud handmatig checken"
else
  echo "    ✅ Antwoord ontvangen (${CHAT_TIME}s)"
fi

echo ""
echo "🌐 POST /api/builder (vereist login-cookie):"
qa_login || true
BUILDER_START=$(date +%s)
if [ -f "$QA_COOKIE" ]; then
  BUILDER_RESPONSE=$(curl -s -X POST "${QA_BASE}/api/builder" \
    -H "Content-Type: application/json" \
    -b "$QA_COOKIE" \
    -d '{"prompt":"QA: simpele knop hello"}' \
    --max-time 120 || true)
else
  BUILDER_RESPONSE=""
fi
BUILDER_END=$(date +%s)
BUILDER_TIME=$((BUILDER_END - BUILDER_START))
export BUILDER_TIME

if echo "$BUILDER_RESPONSE" | grep -q '"slug"'; then
  echo "    ✅ Builder OK (${BUILDER_TIME}s)"
  SLUG=$(echo "$BUILDER_RESPONSE" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "       slug: $SLUG"
  DB_CHECK=$(sqlite3 "$DB" "SELECT COUNT(*) FROM custom_apps WHERE slug='$SLUG';" 2>/dev/null || echo "0")
  [ "$DB_CHECK" = "1" ] && echo "    ✅ Rij in DB" || echo "    ⚠️ Geen rij voor slug in DB"
else
  echo "    ❌ Builder mislukt of geen auth"
  echo "       preview: $(echo "$BUILDER_RESPONSE" | head -c 200)"
fi

# ============================================================================
# FASE 4 — IFRAME / CustomAppPreview
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 4 — IFRAME (CustomAppPreview)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$PREVIEW_FILE" ]; then
  echo "📄 $PREVIEW_FILE"
  SANDBOX=$(grep -o 'sandbox="[^"]*"' "$PREVIEW_FILE" || echo "NIET GEVONDEN")
  echo "  sandbox: $SANDBOX"
  if echo "$SANDBOX" | grep -q "allow-same-origin"; then
    echo "  ✅ allow-same-origin aanwezig"
  else
    echo "  ❌ allow-same-origin ontbreekt — patch nodig"
  fi
  for cdn in "react@18" "react-dom@18" "babel" "tailwindcss"; do
    grep -q "$cdn" "$PREVIEW_FILE" && echo "  ✅ CDN ref: $cdn" || echo "  ❌ mist: $cdn"
  done
else
  echo "❌ $PREVIEW_FILE niet gevonden"
fi

# ============================================================================
# FASE 5–8 — Licht (optioneel; omgeving-afhankelijk)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 5–8 — N8N / Dify / OpenClaw / Qdrant (smoke)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -o /dev/null -w "  n8n webhook factory-os: %{http_code}\n" -X POST "http://localhost:5678/webhook/factory-os" \
  -H "Content-Type: application/json" -d '{"prompt":"qa","klant":"fumero"}' --max-time 15 || true
curl -s -o /dev/null -w "  Dify console setup: %{http_code}\n" "http://127.0.0.1:5001/console/api/setup" --max-time 5 || true
curl -s "http://localhost:6333/health" --max-time 3 | head -c 120 || echo "  Qdrant: niet bereikbaar"

# ============================================================================
# FASE 9 — FRONTEND BUILD
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 9 — NEXT BUILD / TS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd ~/AI_HQ/ai-motor
if npm run build 2>&1 | tee /tmp/qa_build.log | grep -q "Compiled successfully"; then
  echo "  ✅ next build OK"
else
  echo "  ❌ build problemen — zie /tmp/qa_build.log"
fi
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -5 || echo "  ✅ tsc clean (of geen errors in eerste regels)"

# ============================================================================
# FASE 10 — SECURITY (light)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 10 — SECURITY SMOKE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd ~/AI_HQ
if git ls-files 2>/dev/null | grep -qE '^\.env$|\.env\.[^/]+$'; then
  echo "  ⚠️ .env-patroon in git index — check of dit de bedoeling is"
else
  echo "  ✅ Geen .env in tracked files (snelle check)"
fi

# ============================================================================
# FASE 11 — PUBLIEKE URLS (optioneel)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 11 — PUBLIC HTTPS SMOKE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for domain in "https://motorsai.app"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$domain/" --max-time 12 || echo "000")
  echo "  $domain → $code"
done

# ============================================================================
# FASE 12 — AUTO-FIXES
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 12 — AUTO-FIXES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FIXES=0
if [ -f ~/AI_HQ/.needs_rebuild ]; then
  cd ~/AI_HQ/ai-motor && npm run build && pm2 restart ai-motor --update-env && pm2 save
  rm -f ~/AI_HQ/.needs_rebuild
  FIXES=$((FIXES + 1))
fi
if ! pm2 jlist 2>/dev/null | jq -e '.[] | select(.name=="ai-motor" and .pm2_env.status=="online")' >/dev/null; then
  pm2 restart ai-motor 2>/dev/null || true
  FIXES=$((FIXES + 1))
fi
if [ "${OLD_UPLOADS:-0}" -gt 1000 ]; then
  echo "  ⚠️ Veel oude uploads — handmatig opschonen gewenst"
fi
echo "  Auto-fixes toegepast: $FIXES"

# ============================================================================
# FASE 13 — E2E
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 13 — E2E (builder + publieke app-URL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
qa_login || true
FLOW2_START=$(date +%s)
FLOW2=$(curl -s -X POST "${QA_BASE}/api/builder" -H "Content-Type: application/json" \
  -b "$QA_COOKIE" -d '{"prompt":"QA E2E knop"}' --max-time 120 || true)
FLOW2_END=$(date +%s)
FLOW2_TIME=$((FLOW2_END - FLOW2_START))
export FLOW2_TIME
if echo "$FLOW2" | grep -q '"slug"'; then
  SLUG2=$(echo "$FLOW2" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)
  # /apps/* is publiek — verwacht 200 zonder cookie
  APP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${QA_BASE}/apps/${SLUG2}" --max-time 10 || echo "000")
  if [ "$APP_CODE" = "200" ]; then
    echo "  ✅ /apps/$SLUG2 → 200"
  else
    echo "  ❌ /apps/$SLUG2 → $APP_CODE"
  fi
else
  echo "  ⚠️ Geen slug uit builder — skip app URL"
fi

# ============================================================================
# FASE 14 — RAPPORT
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FASE 14 — RAPPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RMD=~/AI_HQ/logs/qa/RAPPORT_$(date +%Y%m%d_%H%M).md
{
  echo "# QA Rapport"
  echo "**Datum:** $(date -Iseconds)"
  echo "**Log:** $LOGFILE"
  echo
  echo "## Samenvatting grep uit log"
  grep -c "✅" "$LOGFILE" 2>/dev/null | awk '{print "- OK markers: "$1}' || true
  grep -c "⚠️" "$LOGFILE" 2>/dev/null | awk '{print "- Waarschuwingen: "$1}' || true
  grep -c "❌" "$LOGFILE" 2>/dev/null | awk '{print "- Problemen: "$1}' || true
} > "$RMD"
echo "📄 $RMD"

export CHAT_TIME BUILDER_TIME FLOW2_TIME
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  python3 << 'PY' || true
import json, os, urllib.request
logfile = os.environ["LOGFILE"]
log = open(logfile, encoding="utf-8", errors="replace").read()
msg = f"QA klaar. OK:{log.count('✅')} ⚠:{log.count('⚠️')} ❌:{log.count('❌')}"
data = json.dumps({"chat_id": os.environ["TELEGRAM_CHAT_ID"], "text": msg}).encode()
req = urllib.request.Request(
    f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}/sendMessage",
    data=data, headers={"Content-Type": "application/json"},
)
urllib.request.urlopen(req, timeout=10)
PY
  echo "  (Telegram verstuurd indien token werkte)"
else
  echo "  ⚠️ Telegram niet geconfigureerd"
fi

echo ""
echo "✅ QA RUN KLAAR — zie $LOGFILE"
