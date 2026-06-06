# Motor Next op NUC — PG cutover readiness

> **Sprint 3.3** · **Gerelateerd:** [`fase1-postgres.md`](fase1-postgres.md) · [`DECISIONS.md`](DECISIONS.md) ADR-002 · [`hybrid-env.md`](hybrid-env.md) · [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md)

Motor Next.js **blijft bewust op de NUC** (PM2 `:3040`). Zware backends draaien op Hetzner. Dit document is de audit-checklist vóór en na de Postgres cutover (M4 = **26 jul 2026**).

## Waarom NUC?

| Factor | NUC | Hetzner |
|--------|-----|---------|
| Latency OpenClaw / local-executor | ✅ lokaal | ❌ |
| SQLite / better-sqlite3 legacy | ✅ tot M6 | ❌ |
| PM2 + Next.js productie | ✅ | ❌ (bewust niet) |
| Postgres, Qdrant, Ollama, n8n, Dify | consumer | ✅ host |

Zie MASTER-BUILD-PLAN Appendix A: *Motor Next op Hetzner* staat op de skip-lijst.

## PM2 & SQLite legacy pad

### Huidige productie (tot M4)

```
Motor Next (PM2 :3040)
  └─ better-sqlite3  ~/AI_HQ/data/ai-motor.db   ← primair read/write
  └─ pg-adapter dual-write (USE_POSTGRES=1)     ← optioneel vanaf M2
  └─ remote DATABASE_URL → Hetzner Postgres
```

### Na M4 (Postgres SSOT)

```
Motor Next (PM2 :3040)
  └─ Postgres primair (POSTGRES_PRIMARY=1)
  └─ SQLite read-only backup (SQLITE_FALLBACK=1)
```

### Na M6 (~9 aug 2026)

```
Motor Next (PM2 :3040)
  └─ Postgres only (SQLITE_FALLBACK=0)
  └─ better-sqlite3 alleen dev/fallback expliciet
  └─ PM2 instances: 1 → evalueren cluster na SQLite uit prod
```

**PM2 `instances: 1`** in `ecosystem.config.cjs` is verplicht tot M6: `better-sqlite3` is single-writer; cluster mode breekt concurrent writes.

## PG cutover readiness checklist

Gebruik vóór M2, M4 en M6. Alle items moeten groen zijn vóór de volgende milestone.

### Infra & connectiviteit

- [ ] Tailscale: `ping hetzner-motor` vanaf NUC
- [ ] `node scripts/hybrid-smoke.mjs` groen (Qdrant, Ollama embed, PG ping)
- [ ] `GET /api/admin/integration-readiness` → `hybrid.hetzner_core_ok: true`
- [ ] `bash scripts/hetzner-load-check.sh` op Hetzner — headroom ≥ 2 GB
- [ ] Postgres backup cron actief (`infra/postgres/backup.sh`)

### Data & migratie (M3)

- [ ] `npm run db:migrate` op Hetzner Postgres
- [ ] `node scripts/migrate-sqlite-to-postgres.mjs --dry-run` — rijtellingen kloppen
- [ ] Live migratie gedraaid (idempotent)
- [ ] Steekproef: chat_history, approvals, auth_users, knowledge_documents in PG

### Auth & tenant isolation (M5)

- [ ] `/api/chat/*` en `/api/conversations/*` → 401 zonder sessie
- [ ] Cross-tenant curl (fumero token → bokas klant) → 403
- [ ] RLS: `app.workspace_id` gezet in route handlers
- [ ] `MOTORSAI_TOKEN` / cookie login werkt in E2E

### Hybrid E2E (Sprint 3.3)

```bash
cd AI_HQ/ai-motor
export BASE_URL=http://127.0.0.1:3040
export MOTORSAI_TOKEN=…          # zelfde waarde als login cookie-bytes
export SKIP_CHAT=1               # geen LLM-kosten in CI

node scripts/e2e-hybrid.mjs
# Volledig incl. infra:
RUN_INFRA_SMOKE=1 REQUIRE_HYBRID_CORE=1 node scripts/e2e-hybrid.mjs
```

- [ ] Chat auth: 401 zonder token, OK met token
- [ ] Kennisbank: `/api/knowledge/qdrant-search` met treffers (dual-search ADR-001)
- [ ] Approvals: `/api/cowork/approvals` 200 + bookkeeping status (offline OK met warn)
- [ ] n8n: `/healthz` bereikbaar als `N8N_BASE_URL` gezet

### Milestone-specifieke gates

| Milestone | Datum | Env flags | Verificatie |
|-----------|-------|-----------|-------------|
| **M2** dual-write | 5 jul 2026 | `USE_POSTGRES=1` | Nieuwe writes in PG + SQLite |
| **M4** PG SSOT | 26 jul 2026 | `POSTGRES_PRIMARY=1` | Reads uit PG; SQLite read-only |
| **M5** RLS prod | 2 aug 2026 | RLS migrations | Cross-tenant curl faalt |
| **M6** SQLite uit | 9 aug 2026 | `SQLITE_FALLBACK=0` | Geen SQLite writes in prod |

### Rollback (tot M4)

1. `POSTGRES_PRIMARY=0` + `USE_POSTGRES=0` in `.env.local`
2. `pm2 restart ecosystem.config.cjs --update-env`
3. SQLite blijft volledige kopie via dual-write historie
4. Zie [`hybrid-env.md#rollback`](hybrid-env.md#rollback-per-service-1-week-read-only)

Na M4: alleen PG restore uit backup — geen automatische SQLite-terugval.

## NUC services die lokaal blijven

| Service | Poort | Notities |
|---------|-------|----------|
| Motor Next.js | 3040 | PM2 `ai-motor` |
| OpenClaw gateway | 18789 | Chat primary routing |
| local-executor | 8790 | PM2 `local-executor` |
| bookkeeping-bot | 8001 | Bokas bonnen; graceful offline in approvals |

**Uit op NUC na Fase 3.1:** Ollama (embed via Hetzner), lokale Qdrant (via Hetzner).

## verify-live integratie

```bash
# Standaard: lint + build + smoke-quality
bash scripts/verify-live.sh

# Hybrid gate (incl. e2e-hybrid):
REQUIRE_HYBRID=1 MOTORSAI_TOKEN=… bash scripts/verify-live.sh
```

`REQUIRE_HYBRID=1` draait `e2e-hybrid.mjs` (met `SKIP_CHAT=1`) na build.

## Documenthistorie

| Datum | Wijziging |
|-------|-----------|
| 2026-06-06 | Sprint 3.3 — NUC audit + PG cutover checklist |
