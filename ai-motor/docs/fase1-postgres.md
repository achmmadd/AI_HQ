# Fase 1 — Postgres & Drizzle (Sprint 1.1)

> **ADR-002** milestones M1 (Postgres live) · M2 (dual-write) · M4 (SSOT 26 jul 2026)  
> **Gerelateerd:** [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md) · [`DECISIONS.md`](DECISIONS.md) · [`hetzner-migration.md`](hetzner-migration.md)

## Architectuur

| Component | Locatie | Notities |
|-----------|---------|----------|
| Motor Next.js | NUC (PM2 :3040) | SQLite primair tot M4 |
| Postgres 16 + pgvector | Hetzner Docker | `infra/postgres/docker-compose.yml` |
| Connectiviteit | Tailscale | `DATABASE_URL` → `hetzner-motor:5432` |
| ORM | Drizzle | `lib/db/drizzle/` |
| RLS | SQL migrations | `drizzle/migrations/0001_rls_policies.sql` |

## 1. Deploy Postgres op Hetzner (M1 — 28 jun 2026)

### Vereisten

- Hetzner CX/CPX 16 GB met Docker
- Tailscale op Hetzner **en** NUC (`hetzner-motor` hostname in `~/.ssh/config`)
- Zie [`hetzner-phase1.md`](hetzner-phase1.md) voor SSH-setup

### Stappen

```bash
# Op Hetzner
sudo mkdir -p /opt/motor
sudo chown "$USER" /opt/motor
cd /opt/motor
git clone <repo> .   # of rsync infra/postgres/

cd infra/postgres
cp .env.example .env
# Genereer wachtwoord:
openssl rand -hex 32
# Vul POSTGRES_PASSWORD in .env

# Optioneel: bind op Tailscale IP zodat NUC kan verbinden
# POSTGRES_BIND=100.x.x.x   # tailscale ip -4 op Hetzner

docker compose up -d
docker compose ps
docker compose logs -f postgres
```

### Verificatie vanaf NUC

```bash
# Tailscale ping
ping -c 2 hetzner-motor

# psql test (installeer client indien nodig)
psql "postgres://motor:PASSWORD@hetzner-motor:5432/motor_ai" -c "SELECT version();"
```

### Backups (dagelijks)

```bash
# Op Hetzner — cron 03:00 UTC
0 3 * * * /opt/motor/infra/postgres/backup.sh >> /var/log/motor-pg-backup.log 2>&1
```

Backups: `/var/backups/motor-postgres/motor_ai_*.sql.gz` (14 dagen retentie).

Restore:

```bash
gunzip -c /var/backups/motor-postgres/motor_ai_YYYYMMDD.sql.gz \
  | docker exec -i motor-postgres psql -U motor -d motor_ai
```

## 2. Drizzle migrations

Vanaf NUC (of Hetzner met `DATABASE_URL`):

```bash
cd AI_HQ/ai-motor
export DATABASE_URL="postgres://motor:PASSWORD@hetzner-motor:5432/motor_ai"

# Schema + RLS + workspace seed
npm run db:migrate

# Of push (dev only, geen migration history)
npm run db:push

# Nieuwe schema-wijzigingen genereren
npm run db:generate
```

Migrations in volgorde:

1. `0000_workspaces_users_memberships.sql` — tabellen
2. `0001_rls_policies.sql` — Row Level Security
3. `0002_seed_workspaces.sql` — fumero, bokas, motor, personal

## 3. Env vars (NUC `.env.local`)

```bash
# Postgres (Fase 1.1 — default uit tot M2)
DATABASE_URL=postgres://motor:PASSWORD@hetzner-motor:5432/motor_ai
USE_POSTGRES=0              # M2 (5 jul): zet op 1 voor dual-write
POSTGRES_PRIMARY=0          # M4 (26 jul): zet op 1 — PG wordt SSOT
SQLITE_FALLBACK=1           # M6: zet op 0 om SQLite prod uit te faseren
```

Zie ook root `.env.example`.

## 4. Dual-write adapter (M2)

`lib/db/pg-adapter.ts` spiegelt `auth_users` writes naar Postgres wanneer `USE_POSTGRES=1`.

- SQLite blijft leidend voor reads tot `POSTGRES_PRIMARY=1`
- Fouten in PG dual-write worden gelogd, breken SQLite-pad niet
- RLS context: `setPgWorkspaceContext({ workspaceId, userId })` — Sprint 1.2 middleware

## 5. Schema-overzicht

| Tabel | Doel |
|-------|------|
| `workspaces` | White-label tenant (slug: fumero, bokas, motor, personal) |
| `users` | Platform users (maps `auth_users`) |
| `workspace_memberships` | M2M users ↔ workspaces met role + scope |

RLS blokkeert cross-tenant SELECT/INSERT wanneer `app.workspace_id` gezet is.

Bypass alleen voor migraties: `set_config('app.bypass_rls', '1', false)`.

## Sprint 1.2 (Week 6–7) — data-migratie & auth upgrade

- [x] `scripts/migrate-sqlite-to-postgres.mjs` — auth_users, chat_history, approvals, knowledge_documents
- [x] Session/JWT met `workspace_id`, `workspaceSlug`, `membershipRole`, `pgUserId`
- [x] API routes → `applyPgWorkspaceContext` → `setPgWorkspaceContext` (RLS `app.workspace_id`)
- [x] `audit_events` tabel + dual-write vanuit `logAudit` wanneer `USE_POSTGRES=1`
- Drizzle migrations: `0003_tenant_data_tables.sql`, `0004_tenant_data_rls.sql`

### Migratie-script

```bash
cd AI_HQ/ai-motor
export DATABASE_URL="postgres://motor:PASSWORD@hetzner-motor:5432/motor_ai"

# Eerst PG schema
npm run db:migrate

# Dry-run (telt SQLite rijen)
node scripts/migrate-sqlite-to-postgres.mjs --dry-run

# Live migratie (idempotent via legacy_sqlite_id / content_sha256 dedup)
node scripts/migrate-sqlite-to-postgres.mjs

# Subset
node scripts/migrate-sqlite-to-postgres.mjs --only auth,chat
```

SQLite-pad: `$HOME/AI_HQ/data/ai-motor.db` (zelfde als `lib/db/database.ts`).

## Sprint 1.3 (Week 8–9) — Qdrant multitenancy & Master Context

- [x] Qdrant payload `workspace_id`, `tenant`, `source` op ingest + filter in search (`lib/qdrant-payload.ts`)
- [x] Master Context File per workspace — `master_contexts` tabel, `lib/master-context.ts`, API CRUD
- [x] Legacy `factory_os` bucket uit productiepaden (`qdrantLegacyCollection()` alleen migratiescript)
- [x] PM2 `instances: 1` gedocumenteerd in `ecosystem.config.cjs` tot M6 (SQLite uit prod)

### Master Context API

```bash
# Lezen
curl -b motorsai_token=... http://localhost:3040/api/workspaces/fumero/context

# Bijwerken
curl -X PATCH -b motorsai_token=... \
  -H 'Content-Type: application/json' \
  -d '{"content":"# Fumero context\n..."}' \
  http://localhost:3040/api/workspaces/fumero/context
```

Workspaces: `fumero`, `bokas`, `motor`, `personal`. Chat preamble laadt master context vóór klant-persona.

### Drizzle migrations (1.3)

4. `0005_master_contexts.sql` — master context tabel
5. `0006_master_contexts_rls.sql` — RLS policies

### PM2 single-instance (ADR-002)

Motor Next blijft `instances: 1` tot **M6** (~9 aug 2026): SQLite single-writer + dual-write fase.
Na Postgres SSOT (M4) en SQLite fallback uit (M6) kan PM2 cluster worden geëvalueerd.

## NUC audit & PG cutover checklist

Volledige readiness-audit (PM2, SQLite legacy, M2–M6 gates, E2E): [`nuc-readiness.md`](nuc-readiness.md).

## Fase 1 exit-criteria
