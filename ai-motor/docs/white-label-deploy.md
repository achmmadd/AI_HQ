# White-label tenant provisioning (< 1 dag)

> **Doel:** Nieuwe MKB-klant live op Motor AI Factory OS — zonder custom code per tenant.  
> **Gerelateerd:** [`MASTER-BUILD-PLAN.md`](MASTER-BUILD-PLAN.md) · [`DECISIONS.md`](DECISIONS.md) · [`hetzner-migration.md`](hetzner-migration.md) · [`fase1-postgres.md`](fase1-postgres.md)

**Tijdlijn:** ~4–8 uur actief werk + DNS/Tailscale propagatie (max. 1 werkdag).

---

## Prerequisites (eenmalig per omgeving)

| # | Item | Status |
|---|------|--------|
| 1 | Hetzner stack draait (Postgres, Qdrant, Ollama embed, LiteLLM, n8n, Dify) | Zie [`hetzner-migration.md`](hetzner-migration.md) |
| 2 | NUC Motor Next.js PM2 `:3040` + OpenClaw gateway | Zie `ecosystem.config.cjs` |
| 3 | Tailscale mesh NUC ↔ Hetzner | `DATABASE_URL`, `QDRANT_URL`, `OLLAMA_URL` |
| 4 | Cloudflare Tunnel / DNS voor `*.motorsai.app` of klant-subdomain | Team wiki |
| 5 | Postgres workspaces + RLS actief | [`fase1-postgres.md`](fase1-postgres.md) |

---

## Checklist — nieuwe tenant `{slug}`

### 1. Workspace aanmaken (Postgres)

```bash
# Op Hetzner of via Drizzle admin script
cd AI_HQ/ai-motor
DATABASE_URL=postgres://... npx drizzle-kit push   # indien schema gewijzigd

# Seed workspace (pas slug + display_name aan)
psql "$DATABASE_URL" -c "
  INSERT INTO workspaces (slug, display_name, legacy_klant)
  VALUES ('acme', 'Acme BV', 'acme')
  ON CONFLICT (slug) DO NOTHING;
"
```

**Acceptatie:** rij zichtbaar in `workspaces`; slug uniek.

### 2. Master Context + eerste admin

1. Log in als platform-admin (`scope=all`).
2. Open **Instellingen → Teamcontext** (`/settings/context`) — schrijf bedrijfsprofiel in gewone taal.
3. Open **Instellingen → Team & rollen** (`/settings/team`) — nodig eerste klant-admin uit (stub-link kopiëren tot e-mail-infra live is).

**API (optioneel):**

```bash
curl -b motorsai_token=... -X PATCH \
  -H 'Content-Type: application/json' \
  -d '{"content":"Acme verkoopt ..."}' \
  https://motorsai.app/api/workspaces/acme/context
```

### 3. Qdrant-collecties

Per tenant (dual-search — zie ADR-001):

| Collectie | Doel |
|-----------|------|
| `factory_os_{slug}` | File-ingest kennisbank |
| `{slug}_kennisbank` | Scrape-pipeline |

```bash
# Env op Motor (NUC .env / PM2)
QDRANT_COLLECTION_PREFIX=factory_os
# Optioneel override:
# QDRANT_ACME_KENNISBANK_COLLECTION=acme_kennisbank
```

Initial ingest: upload via `/kennisbank` of scrape-job; verify met `GET /api/admin/integration-readiness`.

### 4. Theming & workspace shell

| Stap | Actie |
|------|--------|
| Design tokens | Pas `design-system/workspaces.css` aan of voeg `{slug}` theme toe |
| Logo / kleuren | Onboarding flow (`/onboarding`) of handmatig CSS vars |
| Nav / features | Kopieer Fumero/Bokas shell als template; pas `NAV_BY_WORKSPACE` aan |

**Snelle route (bestaand patroon):** map `{slug}` → dedicated route tree (`app/{slug}/`) zoals `fumero/` en `bokas/`.

### 5. Auth & scope

1. Maak user in `auth_users` (SQLite) **of** `users` + `workspace_memberships` (Postgres).
2. `workspace_memberships.role`: `admin` voor klant-eigenaar.
3. `scope` in session: `{slug}` of `all` voor jou als operator.

Tot PG cutover (**26 jul 2026**, ADR-002): dual-write via `USE_POSTGRES=1`.

### 6. Env & secrets (NUC PM2)

```bash
# Minimaal per tenant — geen secrets in repo
MOTORSAI_PASSWORD=...          # of per-user wachtwoorden via auth_users
MOTORSAI_SESSION_SECRET=...
NEXT_PUBLIC_APP_URL=https://acme.motorsai.app

# Hetzner backends (Tailscale)
DATABASE_URL=postgres://...@hetzner-motor:5432/motor_ai
QDRANT_URL=http://100.x.x.x:6333
OLLAMA_URL=http://100.x.x.x:11434
LITELLM_BASE_URL=http://100.x.x.x:4000
```

```bash
pm2 restart ai-motor --update-env
node scripts/hybrid-smoke.mjs
node scripts/smoke-quality.mjs
```

### 7. DNS & TLS

| Record | Waarde |
|--------|--------|
| `acme.motorsai.app` | Cloudflare Tunnel → NUC `:3040` |
| Optioneel widget | `/embed/{slug}/widget/...` rate-limited |

### 8. Smoke & handover

- [ ] Login als klant-admin
- [ ] Onboarding afgerond (`/onboarding`)
- [ ] Chat met kennisbank-treffer
- [ ] Master Context zichtbaar in chat-preview (`/settings/context`)
- [ ] Goedkeuringen / cowork indien van toepassing
- [ ] `GET /api/admin/integration-readiness` groen voor tenant-collecties
- [ ] Klant-document: login-URL, Bas/Max persona, support-contact

---

## Wat nog handmatig blijft (na Fase 4)

| Item | Wanneer |
|------|---------|
| **Stripe billing** | Na team invites — zie MASTER-BUILD-PLAN L7 |
| **E-mail uitnodigingen** | SMTP/Resend — nu stub-link in `/settings/team` |
| **Volledige white-label DNS automation** | Terraform/Cloudflare API — later |
| **Postgres SSOT cutover** | **26 jul 2026** (M4) — [`DECISIONS.md`](DECISIONS.md) |
| **Hetzner service deploy** | Zie [`hetzner-phase1.md`](hetzner-phase1.md) — eenmalig per omgeving, niet per tenant |

---

## Rollback nieuwe tenant

1. Verwijder `workspace_memberships` + `master_contexts` voor `workspace_id`.
2. Verwijder Qdrant-collecties (snapshot eerst indien data waardevol).
3. Verwijder DNS-record.
4. Geen Motor-code rollback nodig — tenant is data + config.

---

## Documenthistorie

| Datum | Wijziging |
|-------|-----------|
| 2026-06-06 | Sprint 4.3 — initieel white-label provisioning runbook |
