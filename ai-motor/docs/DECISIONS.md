# Motor AI Factory OS — Architectuurbeslissingen

> **Doel:** Vastliggende keuzes die Cursor/agents **niet opnieuw mogen uitvinden** in latere sprints.  
> **Gerelateerd:** [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md) · [`hetzner-migration.md`](hetzner-migration.md)

Wijzig een besluit alleen via expliciete PR + update van dit document (met datum en reden).

---

## ADR-001 — Qdrant: dual-search (geen unified collectie)

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** — geïmplementeerd Fase 0 Week 1 |
| **Datum** | 2026-06-06 |
| **Beslisser** | Pietje (vastgelegd vóór Fase 1) |

### Context

Drie inconsistente collectiepaden veroorzaakten lege kennisbank-zoekresultaten:

| Bron | Collectie |
|------|-----------|
| File-ingest | `factory_os_{klant}` |
| Scrape-pipeline | `{klant}_kennisbank` (bijv. `fumero_kennisbank`) |
| Legacy search | `factory_os` (hardcoded) |

Alternatief was **unified collectie**: scrape-content mergen naar `factory_os_{klant}` met payload `source: scrape|file`.

### Besluit

**Dual-search** — `searchKnowledge()` doorzoekt **beide** buckets per klant en merge resultaten op score.

Implementatie: `lib/qdrant-collection.ts` → `qdrantSearchCollectionsForScope()`, `lib/knowledge-service.ts`.

```
fumero → factory_os_fumero + fumero_kennisbank
bokas  → factory_os_bokas  + bokas_kennisbank
```

Geen merge-migratie van scrape-vectors in Fase 0 of Fase 1.

### Gevolgen

| Sprint | Wat wél | Wat níet |
|--------|---------|----------|
| **0.1** | Dual-search, health op beide collecties, migratiescript legacy → scoped buckets | Scrape → unified merge |
| **1.3** | Payload `workspace_id` + `source`; legacy `factory_os` bucket uit prod (migratiescript only) | Opnieuw debatteren unified vs dual |
| **Later (optioneel ADR-003)** | Unified collectie alleen als dual-search operationeel te duur blijkt | — |

### Env-vars (canonical)

| Variabele | Default | Rol |
|-----------|---------|-----|
| `QDRANT_COLLECTION_PREFIX` | `factory_os` | Ingest: `{prefix}_{klant}` |
| `QDRANT_FUMERO_KENNISBANK_COLLECTION` | `fumero_kennisbank` | Scrape Fumero |
| `QDRANT_BOKAS_KENNISBANK_COLLECTION` | `bokas_kennisbank` | Scrape Bokas |
| `QDRANT_COLLECTION` | `factory_os` | Legacy — **uitfaseren** in Sprint 1.3 |

### Acceptatie

- Chat preamble vindt zowel file-ingest als scrape-data voor fumero/bokas.
- `GET /api/admin/integration-readiness` toont alle gemonitorde collecties.
- Geen hardcoded `factory_os` in UI-foutmeldingen (gebruik `collections` uit API).

---

## ADR-002 — SQLite → Postgres cutover (data & tijdlijn)

| Veld | Waarde |
|------|--------|
| **Status** | ✅ **Besloten** |
| **Datum** | 2026-06-06 |
| **Beslisser** | Pietje |
| **Startpunt plan** | Fase 0 Week 1 = 2026-06-06 |

### Context

Motor draait op `better-sqlite3` (`~/AI_HQ/data/ai-motor.db`). Single-writer blokkeert multi-tenant SaaS, PM2 `instances: 1`, en white-label uitrol. Postgres komt op **Hetzner**; Motor Next.js blijft op **NUC** met remote `DATABASE_URL` via Tailscale.

### Besluit — milestones (hard)

| Milestone | Datum | Sprint | Criterium |
|-----------|-------|--------|-----------|
| **M0 — Geen nieuwe SQLite-only tabellen** | **2026-06-20** | Fase 0 exit | Nieuwe schema’s alleen Drizzle/Postgres-ready of in `platform-schema.ts` met PG-migratie in zelfde PR |
| **M1 — Postgres live op Hetzner** | **2026-06-28** | 1.1 | `infra/postgres/docker-compose.yml`; Tailscale bereikbaar; dagelijkse backup |
| **M2 — Dual-write aan** | **2026-07-05** | 1.1 | `USE_POSTGRES=1` schrijft SQLite **én** Postgres; SQLite blijft read-fallback |
| **M3 — Migratie-script gedraaid** | **2026-07-19** | 1.2 | `scripts/migrate-sqlite-to-postgres.mjs`; chat_history, auth, approvals, knowledge_documents over |
| **M4 — Postgres SSOT** | **2026-07-26** | 1.2 exit | Default read/write = Postgres; SQLite read-only backup |
| **M5 — RLS productie** | **2026-08-02** | 1.3 | Drizzle RLS policies actief; cross-tenant curl → 403/DB error |
| **M6 — SQLite uit productie** | **2026-08-09** | 1.3 exit | `better-sqlite3` alleen nog `NODE_ENV=development` of expliciete fallback flag |

**Cutover-datum (M4)** = **26 juli 2026** — dit is de officiële “Postgres is waarheid”-datum.

### Gevolgen

| Onderdeel | Tot M4 (26 jul) | Na M4 |
|-----------|-----------------|-------|
| Motor app locatie | NUC | NUC |
| Database | SQLite primair → dual-write | Postgres primair |
| PM2 instances | 1 | 1 tot M6; daarna evalueren |
| Qdrant | Hetzner (Fase 0/3) | ongewijzigd |
| LightRAG evaluatie | ❌ | ✅ pas na M4 |
| Nieuwe tenants | Hardcoded fumero/bokas OK | Workspace-tabel verplicht |

### Feature flags

```bash
# Fase 1.1
USE_POSTGRES=0          # default tot M2
DATABASE_URL=postgres://...@hetzner:5432/motor_ai

# Fase 1.2
USE_POSTGRES=1          # dual-write vanaf M2
POSTGRES_PRIMARY=0      # tot M4
POSTGRES_PRIMARY=1      # vanaf M4 — SQLite read-only

# Fase 1.3 exit
SQLITE_FALLBACK=0       # vanaf M6 — prod zonder SQLite
```

### Rollback

Tot **M4**: zet `POSTGRES_PRIMARY=0`, herstart PM2 — SQLite blijft volledige kopie via dual-write.  
Na **M4**: rollback alleen via PG restore uit backup (geen automatische SQLite-terugval).

### Acceptatie Fase 1

- [ ] M1–M6 datums gehaald of expliciet verschoven met update van dit document
- [ ] RLS penetration test faalt cross-tenant
- [ ] Geen `better-sqlite3` write in productie na M6

---

## ADR-index (overzicht)

| ID | Onderwerp | Status |
|----|-----------|--------|
| ADR-001 | Qdrant dual-search | ✅ Besloten |
| ADR-002 | SQLite → Postgres cutover | ✅ Besloten |
| ADR-003 | Qdrant unified collectie (optioneel) | ⏸ Open — alleen na ADR-001 evaluatie Q3 2026 |

---

## Documenthistorie

| Datum | Wijziging |
|-------|-----------|
| 2026-06-06 | ADR-001 dual-search + ADR-002 Postgres milestones (M0–M6) |
| 2026-06-06 | Sprint 1.3: Qdrant payload schema, master_contexts, PM2 single-instance note |
