#!/usr/bin/env bash
# Controleer Dify API, OpenClaw/Optimus API en optioneel n8n — zonder secrets te printen.
# Gebruik: cd ~/AI_HQ && ./scripts/check_dify_n8n_openclaw.sh
# Vereist: curl. Leest .env uit repo-root (één map boven scripts/).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
FAIL=0

say() { printf '%s\n' "$*"; }
ok() { say "  OK  $*"; }
bad() { say "  FAIL $*"; FAIL=1; }

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    say "Geen $ENV_FILE — kopieer .env.example naar .env en vul Dify/OpenClaw in."
    exit 2
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

http_code() {
  local url=$1
  shift
  # Geen "|| echo" — bij DNS-fout schrijft curl al "000" naar stdout en faalt; dubbel echo gaf "000000".
  curl -sS -o /dev/null -w "%{http_code}" --connect-timeout "${CURL_CONNECT_TIMEOUT:-10}" "$@" "$url" 2>/dev/null || true
}

strip_slash() {
  local x="${1:-}"
  x="${x%/}"
  printf '%s' "$x"
}

check_dify() {
  say "== Dify API =="
  local base
  base="$(strip_slash "${DIFY_API_BASE:-${DIFY_BASE_URL:-}}")"
  if [[ -z "$base" ]]; then
    bad "DIFY_BASE_URL (of DIFY_API_BASE) ontbreekt in .env"
    return
  fi

  local key="${DIFY_API_KEY_optimus:-}"
  if [[ -z "$key" ]]; then
    bad "DIFY_API_KEY_optimus ontbreekt (gebruik voor smoke-test een geldige app-key)"
    return
  fi

  local code
  code="$(http_code "${base}/v1/parameters" -H "Authorization: Bearer ${key}")"
  if [[ "$code" == "200" ]]; then
    ok "GET ${base}/v1/parameters → 200"
  else
    bad "GET ${base}/v1/parameters → HTTP $code (verwacht 200; check URL, key en firewall)"
  fi
}

check_openclaw() {
  say "== OpenClaw / Optimus API =="
  local pub="${OPENCLAW_PUBLIC_BASE_URL:-}"
  local internal="${OPENCLAW_BASE_URL:-}"
  local base
  base="$(strip_slash "${pub:-$internal}")"
  if [[ -z "$base" ]]; then
    bad "OPENCLAW_PUBLIC_BASE_URL en OPENCLAW_BASE_URL ontbreken"
    return
  fi

  local code
  code="$(http_code "${base}/health")"
  local used_fallback=""
  # Zonder OPENCLAW_PUBLIC_BASE_URL faalt een Docker-service-naam op de host — optioneel lokaal proberen.
  if [[ -z "$pub" && "$code" != "200" ]]; then
    local local_try
    local_try="$(strip_slash "${OPENCLAW_LOCAL_FALLBACK:-http://127.0.0.1:8890}")"
    local alt
    alt="$(http_code "${local_try}/health")"
    if [[ "$alt" == "200" ]]; then
      base="$local_try"
      code="$alt"
      used_fallback=1
      say "      (gebruikt tijdelijk ${local_try} — zet OPENCLAW_PUBLIC_BASE_URL in .env voor n8n/externe checks)"
    fi
  fi

  if [[ "$code" == "200" ]]; then
    ok "GET ${base}/health → 200"
  else
    bad "GET ${base}/health → HTTP $code"
    if [[ -z "$pub" && -n "$internal" ]]; then
      say "      Tip: zet OPENCLAW_PUBLIC_BASE_URL (LAN/Tailscale/proxy) — Docker-hostname is niet resolvebaar buiten dat netwerk."
    fi
  fi

  local ver
  ver="$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT:-10}" "${base}/openapi.json" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('info',{}).get('version','?'))" 2>/dev/null || echo "?")"
  if [[ "$ver" != "?" ]]; then
    ok "OpenAPI info.version = ${ver}"
  else
    bad "Kon OpenAPI-versie niet lezen op ${base}/openapi.json"
  fi
  if [[ -n "$used_fallback" ]]; then
    say "      OpenClaw-check geslaagd via fallback; voor productie-keten toch OPENCLAW_PUBLIC_BASE_URL invullen."
  fi
}

check_n8n() {
  say "== n8n =="
  local base
  base="$(strip_slash "${N8N_BASE_URL:-}")"
  if [[ -z "$base" ]]; then
    # Standaard op veel NUC-setup: Docker-container `n8n`, poort 5678 op de host.
    local probe="http://127.0.0.1:5678"
    local hz
    hz="$(http_code "${probe}/healthz")"
    if [[ "$hz" == "200" ]]; then
      base="$probe"
      say "  (N8N_BASE_URL niet gezet — ${probe} reageert; vul N8N_BASE_URL in .env voor vaste documentatie)"
    else
      say "  SKIP Geen N8N_BASE_URL en geen n8n op ${probe} (HTTP ${hz}) — zet N8N_BASE_URL handmatig"
      return
    fi
  fi
  local code
  # n8n: /healthz is gebruikelijk; fallback /
  code="$(http_code "${base}/healthz")"
  if [[ "$code" == "200" ]]; then
    ok "GET ${base}/healthz → 200"
    return
  fi
  code="$(http_code "${base}/")"
  if [[ "$code" == "200" || "$code" == "302" || "$code" == "304" ]]; then
    ok "GET ${base}/ → HTTP $code (n8n bereikbaar)"
  else
    bad "n8n ${base} → healthz en / gaven geen duidelijke OK (laatste HTTP $code)"
  fi
}

main() {
  say "Connectivity check (env: $ENV_FILE)"
  load_env
  check_dify
  check_openclaw
  check_n8n
  say ""
  if [[ "$FAIL" -eq 0 ]]; then
    say "Alle uitgevoerde checks geslaagd."
    exit 0
  fi
  say "Een of meer checks faalden — zie docs/E2E_DIFY_N8N_OPENCLAW.md"
  exit 1
}

main "$@"
