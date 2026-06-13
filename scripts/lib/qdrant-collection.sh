#!/usr/bin/env bash
# Shell mirror of ai-motor/lib/qdrant-collection.ts — keep in sync with TS SSOT.

qdrant_collection_prefix() {
  local p="${QDRANT_COLLECTION_PREFIX:-factory_os}"
  p="${p%/}"
  echo "${p:-factory_os}"
}

qdrant_legacy_collection() {
  local c="${QDRANT_COLLECTION:-factory_os}"
  c="${c%/}"
  echo "${c:-factory_os}"
}

_qdrant_normalize_klant() {
  local k="${1,,}"
  case "$k" in
    fumero|bokas|motor) echo "$k" ;;
    system|algemeen) echo "motor" ;;
    *) echo "motor" ;;
  esac
}

# Per-klant ingest bucket: factory_os_{klant}
qdrant_collection_for_scope() {
  local klant
  klant=$(_qdrant_normalize_klant "${1:-motor}")
  echo "$(qdrant_collection_prefix)_${klant}"
}

# Scrape bucket per klant (dual-search ADR-001); leeg voor motor
qdrant_scrape_collection_for_scope() {
  local klant
  klant=$(_qdrant_normalize_klant "${1:-motor}")
  case "$klant" in
    fumero) echo "${QDRANT_FUMERO_KENNISBANK_COLLECTION:-fumero_kennisbank}" ;;
    bokas) echo "${QDRANT_BOKAS_KENNISBANK_COLLECTION:-bokas_kennisbank}" ;;
    *) echo "" ;;
  esac
}

# SSOT: listMonitoredQdrantCollections() — backup/health targets (geen legacy bucket)
list_monitored_qdrant_collections() {
  local klant ingest scrape
  for klant in fumero bokas motor; do
    ingest=$(qdrant_collection_for_scope "$klant")
    echo "$ingest"
    scrape=$(qdrant_scrape_collection_for_scope "$klant")
    if [ -n "$scrape" ] && [ "$scrape" != "$ingest" ]; then
      echo "$scrape"
    fi
  done
}

# Probe collection: prints "status|points_count" (status: green, yellow, MISSING, ERR, …)
qdrant_collection_probe() {
  local name="$1"
  local base="${QDRANT_URL:-http://localhost:6333}"
  base="${base%/}"
  curl -s --max-time 5 "${base}/collections/${name}" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  r = d.get('result') or {}
  if not r:
    print('MISSING|0')
  else:
    st = r.get('status') or '?'
    pc = r.get('points_count', 0)
    print(f'{st}|{pc}')
except Exception:
  print('ERR|0')
" 2>/dev/null || echo "ERR|0"
}
