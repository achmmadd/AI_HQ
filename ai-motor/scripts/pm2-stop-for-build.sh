#!/usr/bin/env bash
# next start (PM2) and next build both read/write .next/server — concurrent use causes
# ENOENT on pages-manifest.json during "Collecting page data".
set -euo pipefail
if [[ "${SKIP_PM2_BUILD_GUARD:-0}" == "1" ]]; then
  exit 0
fi
if ! command -v pm2 >/dev/null 2>&1; then
  exit 0
fi
if pm2 describe ai-motor >/dev/null 2>&1; then
  status="$(pm2 jlist 2>/dev/null | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const apps=JSON.parse(d);
        const a=apps.find(x=>x.name==='ai-motor');
        process.stdout.write(a?.pm2_env?.status||'');
      } catch { process.stdout.write(''); }
    });
  ")"
  if [[ "$status" == "online" ]]; then
    echo "== build: pm2 stop ai-motor (exclusive .next build) =="
    pm2 stop ai-motor
  fi
fi
