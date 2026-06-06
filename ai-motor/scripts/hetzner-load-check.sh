#!/usr/bin/env bash
# Hetzner 16 GB RAM budget check — Sprint 3.3 / MASTER-BUILD-PLAN Appendix C.
#
# Op Hetzner (of via ssh hetzner-motor):
#   bash scripts/hetzner-load-check.sh
#
# Vanaf NUC:
#   ssh hetzner-motor 'bash -s' < scripts/hetzner-load-check.sh
#
# Optioneel:
#   WARN_MB=2048   — waarschuwing als beschikbaar < 2 GB (default)
#   FAIL_MB=512    — exit 1 als beschikbaar < 512 MB (default 0 = nooit fail)

set -euo pipefail

WARN_MB="${WARN_MB:-2048}"
FAIL_MB="${FAIL_MB:-0}"

echo "== Hetzner load check ($(date -Iseconds)) =="
echo "   Budget: ~10–14 GB baseline, 2–6 GB headroom (16 GB totaal)"
echo "   Docs: docs/MASTER-BUILD-PLAN.md Appendix C · infra/hetzner/"
echo ""

if ! command -v free >/dev/null 2>&1; then
  echo "✗ 'free' niet gevonden"
  exit 1
fi

echo "── Host memory (free -h) ──"
free -h

avail_kb=$(awk '/^Mem:/ {print $7}' /proc/meminfo 2>/dev/null || free | awk '/^Mem:/ {print $7}')
avail_mb=$((avail_kb / 1024))
echo ""
echo "  Available (MemAvailable): ${avail_mb} MB"

if [[ "$FAIL_MB" -gt 0 && "$avail_mb" -lt "$FAIL_MB" ]]; then
  echo "✗ FAIL: beschikbaar ${avail_mb} MB < FAIL_MB=${FAIL_MB}"
  exit 1
fi

if [[ "$avail_mb" -lt "$WARN_MB" ]]; then
  echo "⚠ WARN: beschikbaar ${avail_mb} MB < WARN_MB=${WARN_MB} — OOM-risico onder load"
else
  echo "✓ Headroom OK (${avail_mb} MB beschikbaar)"
fi

echo ""
echo "── Docker containers (docker stats --no-stream) ──"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" 2>/dev/null || \
    docker stats --no-stream 2>/dev/null || echo "  (geen running containers)"
else
  echo "  Docker niet bereikbaar — skip container stats"
fi

echo ""
echo "── Indicatieve service budget (16 GB) ──"
cat <<'EOF'
  Postgres      1.5–2 GB    altijd
  Qdrant        2–4 GB      altijd
  Ollama embed  ~0.7 GB     altijd
  n8n           0.5–1 GB    profile full
  Dify stack    4–6 GB      extern /opt/dify
  LiteLLM       0.3–0.5 GB  profile litellm
  Inngest       0.3–0.5 GB  worker
  agent-browser 1–2 GB      on-demand only
  ─────────────────────────────────────
  Baseline      ~10–14 GB
  Headroom      2–6 GB
EOF

echo ""
echo "── Regels ──"
echo "  • Geen Langfuse self-host op deze box"
echo "  • Geen chat-LLM (8B+) op Ollama naast Dify"
echo "  • agent-browser alleen spin-up bij taak"
echo ""
echo "── Snelle follow-up ──"
echo "  watch -n5 free -h"
echo "  docker compose -f infra/hetzner/docker-compose.yml ps"
echo "  node scripts/hybrid-smoke.mjs   # vanaf NUC"
