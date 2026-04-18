#!/usr/bin/env bash
# Factory OS V3 — productie rollout (expliciete stappen, geen markdown-parser)
#
# Omgeving (optioneel):
#   DRY_RUN=1   — geen mutaties: geen commit/push/crontab/gate-file/Telegram/status-commit
#   SKIP_GIT=1  — sla DEEL 1 (git) over
#
# Gebruik:
#   DRY_RUN=1 bash ~/AI_HQ/scripts/factory_os_v3_rollout.sh
#   bash ~/AI_HQ/scripts/factory_os_v3_rollout.sh

: "${DRY_RUN:=0}"
: "${SKIP_GIT:=0}"

set -euo pipefail

AI_HQ="${AI_HQ:-$HOME/AI_HQ}"
cd "$AI_HQ"

mkdir -p "$AI_HQ/logs"
LOG_FILE="$AI_HQ/logs/v3_rollout_$(date +%Y%m%d_%H%M).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "🏭 FACTORY OS V3 — ROLLOUT"
echo "Log: $LOG_FILE"
echo "DRY_RUN=$DRY_RUN SKIP_GIT=$SKIP_GIT"
echo "=========================="

dry_run() {
  [ "$DRY_RUN" = "1" ] || [ "$DRY_RUN" = "true" ]
}

# Alleen regel toevoegen als die nog niet (exact) in .gitignore staat
gitignore_append_line() {
  local line="$1"
  local g="$AI_HQ/.gitignore"
  touch "$g"
  if grep -qxF "$line" "$g" 2>/dev/null; then
    return 0
  fi
  if dry_run; then
    echo "[DRY_RUN] zou toevoegen aan .gitignore: $line"
  else
    printf '%s\n' "$line" >> "$g"
    echo "✅ .gitignore += $line"
  fi
}

merge_gitignore_rules() {
  echo "=== .gitignore (alleen ontbrekende regels) ==="
  local rules=(
    "# Secrets"
    ".env"
    ".env.*"
    "!.env.example"
    "*.key"
    "*.pem"
    "# Data"
    "*.db"
    "state.json"
    "holding/data/"
    "__pycache__/"
    "*.pyc"
    "# Tools"
    "node_modules/"
    ".DS_Store"
    "# Archieven"
    "cherry-studio.archief/"
    "*.archief/"
    "# Logs"
    "*.log"
    "logs/"
  )
  local r
  for r in "${rules[@]}"; do
    gitignore_append_line "$r"
  done
}

# Verwijder gevoelige paden uit index vóór commit
strip_secrets_from_index() {
  echo "=== git reset (secrets uit index) ==="
  if dry_run; then
    echo "[DRY_RUN] zou: git reset HEAD -- .env '.env.*' '*.db' state.json (indien gestaged)"
    git diff --cached --name-only | grep -E '^\.env|\.db$|state\.json$' || true
    return 0
  fi
  git reset HEAD -- .env 2>/dev/null || true
  # pathspecs voor varianten
  git reset HEAD -- '.env.*' 2>/dev/null || true
  git reset HEAD -- '*.db' 2>/dev/null || true
  git reset HEAD -- state.json 2>/dev/null || true
  git reset HEAD -- holding/data/ 2>/dev/null || true
}

git_add_known_paths() {
  echo "=== git add (alleen bekende paden) ==="
  local adds=(
    "factory-os/docs"
    "factory-os/klanten"
    "factory-os/systeem"
    "scripts/factory_os_v3_rollout.sh"
  )
  local p
  for p in "${adds[@]}"; do
    if [ ! -e "$AI_HQ/$p" ]; then
      echo "⏭️  overslaan (bestaat niet): $p"
      continue
    fi
    if dry_run; then
      echo "[DRY_RUN] git add -n $p"
      git add -n "$p" 2>/dev/null || true
    else
      git add "$p"
      echo "✅ git add $p"
    fi
  done
  local dc
  for dc in docker-compose.yml docker-compose.ai_hq.yml docker-compose.singularity.yml; do
    if [ -f "$AI_HQ/$dc" ]; then
      if dry_run; then
        echo "[DRY_RUN] git add -n $dc"
        git add -n "$dc" 2>/dev/null || true
      else
        git add "$dc"
        echo "✅ git add $dc"
      fi
    fi
  done
}

deel1_git() {
  if [ "$SKIP_GIT" = "1" ]; then
    echo "=== DEEL 1 GIT — overgeslagen (SKIP_GIT=1) ==="
    return 0
  fi
  echo "=== DEEL 1 — GIT ==="

  git remote -v || true

  local remote
  remote=$(git remote get-url origin 2>/dev/null || echo "")
  if echo "$remote" | grep -q "https://github.com"; then
    local ssh_remote
    ssh_remote=$(echo "$remote" | sed 's|https://github.com/|git@github.com:|')
    if dry_run; then
      echo "[DRY_RUN] zou: git remote set-url origin $ssh_remote"
    else
      git remote set-url origin "$ssh_remote"
      echo "✅ Remote → SSH: $ssh_remote"
    fi
  fi

  if ssh -T -o StrictHostKeyChecking=accept-new git@github.com 2>&1 | grep -qi "successfully"; then
    echo "✅ SSH naar GitHub OK"
  else
    echo "⚠️  SSH naar GitHub niet bevestigd — push kan falen"
  fi

  merge_gitignore_rules
  if ! dry_run; then
    git add .gitignore 2>/dev/null || true
  else
    echo "[DRY_RUN] zou: git add .gitignore"
    git add -n .gitignore 2>/dev/null || true
  fi

  echo "Open status (eerste regels):"
  git status --short | head -30 || true

  git_add_known_paths
  strip_secrets_from_index

  echo ""
  echo "⚠️  Fumero-kennisbank kan gevoelige inhoud bevatten."
  echo "    Publieke repo → verplaats kennisbank naar private submodule of haal uit git."
  echo ""

  if dry_run; then
    echo "[DRY_RUN] geen git commit / push"
    return 0
  fi

  if git diff --cached --quiet; then
    echo "ℹ️  Niets te committen na staging"
  else
    git commit -m "chore: V3 rollout — gitignore + factory-os paden" || true
  fi

  if git push origin master 2>/dev/null; then
    echo "✅ git push origin master"
  else
    echo "⚠️  git push mislukt — later: git push origin master"
  fi

  echo "=== DEEL 1 KLAAR ==="
}

# HTTP code voor URL
http_code() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url" 2>/dev/null || echo "000"
}

deel2_health_gate() {
  echo "=== DEEL 2 — HEALTH + GATE ==="
  set -a
  # shellcheck source=/dev/null
  source "$AI_HQ/.env"
  set +a

  : "${DIFY_BASE_URL:?Zet DIFY_BASE_URL in $AI_HQ/.env}"

  if ! dry_run; then
    rm -f "$AI_HQ/.factory_os_v3_ok"
  fi

  local fail=0
  local name url code

  while IFS= read -r line; do
    [ -z "$line" ] && continue
    name="${line%%|*}"
    url="${line#*|}"
    code=$(http_code "$url")
    if [ "$code" = "200" ]; then
      echo "✅ $name ($code)"
    else
      echo "❌ $name ($code) — $url"
      fail=1
    fi
  done <<EOF
n8n|http://localhost:5678/healthz
qdrant|http://localhost:6333/healthz
ollama|http://localhost:11434/api/tags
dify|${DIFY_BASE_URL%/}/health
EOF

  code=$(http_code "http://localhost:3000")
  if [ "$code" = "200" ] || [ "$code" = "302" ]; then
    echo "✅ open-webui ($code)"
  else
    echo "❌ open-webui ($code)"
    fail=1
  fi

  if [ "$fail" -ne 0 ]; then
    echo "=== DEEL 2 MISLUKT — geen .factory_os_v3_ok ==="
    return 1
  fi

  if dry_run; then
    echo "[DRY_RUN] zou aanmaken: $AI_HQ/.factory_os_v3_ok"
  else
    touch "$AI_HQ/.factory_os_v3_ok"
    echo "✅ Gate: $AI_HQ/.factory_os_v3_ok"
  fi
  echo "=== DEEL 2 KLAAR ==="
  return 0
}

ensure_backup_cron() {
  local script_path="$AI_HQ/scripts/factory_os_backup.sh"
  if [ ! -x "$script_path" ]; then
    return 0
  fi
  local line="0 3 * * * $script_path"
  if crontab -l 2>/dev/null | grep -Fq "$script_path"; then
    echo "✅ cron bevat al backup: $script_path"
    return 0
  fi
  if dry_run; then
    echo "[DRY_RUN] zou crontab regel toevoegen: $line"
    return 0
  fi
  (crontab -l 2>/dev/null; echo "$line") | crontab -
  echo "✅ cron backup regel toegevoegd"
}

deel3_finale() {
  echo "=== DEEL 3 — FINALE VALIDATIE ==="
  set -a
  # shellcheck source=/dev/null
  source "$AI_HQ/.env"
  set +a

  local verified=()
  local telegram_get_me_ok=0

  local code
  code=$(http_code "http://localhost:5678/healthz")
  [ "$code" = "200" ] && verified+=("n8n health 200") || echo "❌ n8n"

  code=$(http_code "http://localhost:6333/healthz")
  [ "$code" = "200" ] && verified+=("qdrant health 200") || echo "❌ qdrant"

  : "${DIFY_BASE_URL:?}"
  code=$(http_code "${DIFY_BASE_URL%/}/health")
  [ "$code" = "200" ] && verified+=("dify health 200") || echo "❌ dify"

  if [ -f "$HOME/.openclaw/mcp.json" ]; then
    verified+=("~/.openclaw/mcp.json aanwezig")
    echo "✅ MCP config aanwezig"
  else
    echo "⚠️  ~/.openclaw/mcp.json mist (nog niet geconfigureerd?)"
  fi

  local qc
  qc=$(curl -s --max-time 5 "http://localhost:6333/collections/factory_os" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  st=d.get('result',{}).get('status')
  print(st or '?')
except Exception:
  print('ERR')
" 2>/dev/null || echo "ERR")
  if [ "$qc" = "green" ]; then
    verified+=("Qdrant collection factory_os: green")
    echo "✅ Qdrant factory_os: green"
  else
    echo "⚠️  Qdrant factory_os: $qc (nog aanmaken via V3 prompt STAP 6?)"
  fi

  local backup_ok=0
  if [ -x "$AI_HQ/scripts/factory_os_backup.sh" ]; then
    verified+=("factory_os_backup.sh uitvoerbaar")
    backup_ok=1
    echo "✅ Backup script aanwezig"
  fi
  if [ "$backup_ok" = "1" ] && crontab -l 2>/dev/null | grep -Fq "factory_os_backup.sh"; then
    verified+=("cron met factory_os_backup.sh")
    echo "✅ Backup cron actief"
  fi

  ensure_backup_cron

  # Telegram: alleen geclaimd wat geverifieerd is
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    if curl -sf "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -c "import sys,json; assert json.load(sys.stdin).get('ok')" 2>/dev/null; then
      verified+=("Telegram getMe OK")
      telegram_get_me_ok=1
    else
      echo "❌ Telegram getMe faalde — geen sendMessage"
    fi
  else
    echo "⚠️  Geen TELEGRAM_* in .env — geen bericht"
  fi

  if dry_run; then
    echo "[DRY_RUN] zou Telegram sendMessage (alleen bij getMe OK) met:"
    printf ' - %s\n' "${verified[@]}"
    echo "=== DEEL 3 KLAAR (dry-run) ==="
    return 0
  fi

  if [ "$telegram_get_me_ok" = "1" ] && [ "${#verified[@]}" -gt 0 ]; then
    local json_payload
    json_payload=$(printf '%s\n' "${verified[@]}" | TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID}" python3 << 'PY'
import json, os, sys
verified = [l.strip() for l in sys.stdin if l.strip()]
lines = ["🏭 Factory OS V3 — rapport (geverifieerd)", ""]
lines += ["✅ " + x for x in verified]
lines += ["", "Test: Wat weet je over Fumero?"]
print(json.dumps({"chat_id": os.environ["TELEGRAM_CHAT_ID"], "text": "\n".join(lines)}))
PY
)
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      --data-binary "$json_payload" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Telegram verstuurd' if d.get('ok') else d)" || true
  fi

  echo "=== DEEL 3 KLAAR ==="
}

deel4_status_doc() {
  echo "=== DEEL 4 — V3_STATUS.md ==="
  local ts
  ts=$(date +"%d-%m-%Y %H:%M")
  local mcp_block
  mcp_block=$(cat "$HOME/.openclaw/mcp.json" 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  for k in d.get('mcpServers',{}):
    print('✅', k)
except Exception:
  print('❌ mcp.json niet leesbaar')
" 2>/dev/null || echo "❌ mcp.json mist")

  if dry_run; then
    echo "[DRY_RUN] zou schrijven: $AI_HQ/factory-os/docs/V3_STATUS.md"
    echo "=== DEEL 4 KLAAR (dry-run) ==="
    return 0
  fi

  mkdir -p "$AI_HQ/factory-os/docs"
  local n8n_st q_st ol_st c
  c=$(http_code "http://localhost:5678/healthz")
  [ "$c" = "200" ] && n8n_st="✅ n8n" || n8n_st="❌ n8n"
  c=$(http_code "http://localhost:6333/healthz")
  [ "$c" = "200" ] && q_st="✅ qdrant" || q_st="❌ qdrant"
  c=$(http_code "http://localhost:11434/api/tags")
  [ "$c" = "200" ] && ol_st="✅ ollama" || ol_st="❌ ollama"

  cat > "$AI_HQ/factory-os/docs/V3_STATUS.md" << EOF
# Factory OS V3 — Status $ts

## Services (snapshot)
$n8n_st
$q_st
$ol_st

## MCP servers (config keys)
$mcp_block

## Optioneel
- Holo3 / portal.hcompany.ai — alleen indien je dat stack-onderdeel gebruikt; niet onderdeel van Factory OS core.

## Waarschuwing
- Publieke GitHub-repo met Fumero-kennisbank is risicovol → verplaats naar **private submodule** of verwijder gevoelige export uit git.

## Handmatig (checklist)
- [ ] OpenClaw Telegram-kanaal: \`openclaw onboard\` (indien nodig)
- [ ] SSH-key voor \`git push\` op deze NUC

## Test
Telegram → "Wat weet je over Fumero?" — antwoord uit kennisbank = OK.
EOF

  strip_secrets_from_index
  git add "$AI_HQ/factory-os/docs/V3_STATUS.md" 2>/dev/null || true
  strip_secrets_from_index
  if ! git diff --cached --quiet; then
    git commit -m "docs: V3 status rapport" || true
  fi
  echo "=== DEEL 4 KLAAR ==="
}

# --- main ---
deel1_git
deel2_health_gate
if [ ! -f "$AI_HQ/.factory_os_v3_ok" ]; then
  echo "⏭️  DEEL 3/4 overgeslagen (geen gate-bestand — DEEL 2 faalde of DRY_RUN=1)"
  echo "    Tip: zonder DRY_RUN en met groene health wordt .factory_os_v3_ok gezet."
  exit 0
fi

deel3_finale
deel4_status_doc

echo ""
echo "🏭 FACTORY OS V3 ROLLOUT AFGEROND"
echo "Log: $LOG_FILE"
