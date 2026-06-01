# URL Reader (scrape_url) — platform

**Long-term:** één Motor-engine, meerdere **tenants** (Fumero, Bokas, …). Bouwen/Chat blijven wraps; scrape + kennisbank zijn **tenant-config**, geen apart product per bedrijf.

## Architectuur

```
Gebruiker (Max Chat)
       ↓
buildScrapeUrlChatContext (tenant)
       ↓
scrapeUrl({ url, tenant })  ← whitelist per tenant
       ↓
Provider: auto | jina | native
       ↓
Markdown → antwoord / Qdrant kennisbank
```

| Laag | Rol |
|------|-----|
| **Tenant** (`lib/scrape/tenants.ts`) | Domein-whitelist, refresh-pagina's, Qdrant-collectie |
| **Provider** | **Jina** (kwaliteit) of **native fetch** (fallback, geen extra key) |
| **LLM (Qwen/DeepSeek)** | Alleen redeneren over de opgehaalde tekst — geen scrape |

## Providers

| `SCRAPE_PROVIDER` | Gedrag |
|-------------------|--------|
| `auto` (default) | Jina als `JINA_API_KEY` gezet; anders native. Bij Jina-fout → native. |
| `jina` | Alleen Jina |
| `native` | Alleen HTTP-fetch (gratis, minder goed op JS-shops) |

**Waarom niet Grok/Qwen als scraper?** Modellen antwoorden; ze halen geen vaste URL betrouwbaar op voor cron/kennisbank. Research-chat gebruikt apart **Perplexity Sonar** (`CHAT_RESEARCH_MODEL`).

## Nieuwe tenant (wrap)

1. Voeg entry toe in `lib/scrape/tenants.ts`:
   - `domainWhitelist`
   - `kennisbankRefreshPages`
   - `kennisbankCollection` (optioneel)
2. Automation: `runTenantKennisbankRefresh("bokas")` + cron-task in `db-migrate` / Automations.
3. Chat: `buildScrapeUrlChatContext` met `tenant` (nu Fumero hardcoded; later vanuit workspace scope).
4. API: `POST /api/{tenant}/scrape-url` of gedeelde route met `tenant` body.

## Omgeving

| Variabele | Beschrijving |
|-----------|--------------|
| `SCRAPE_PROVIDER` | `auto` \| `jina` \| `native` |
| `JINA_API_KEY` | Optioneel; aanbevolen voor productie kwaliteit |
| `QDRANT_URL` | Voor kennisbank-upsert |
| `QDRANT_FUMERO_KENNISBANK_COLLECTION` | Default `fumero_kennisbank` |
| `QDRANT_BOKAS_KENNISBANK_COLLECTION` | Default `bokas_kennisbank` |

## Max-gedrag (geen “nee”)

Max moet weten:

- **Live pagina** op whitelist → `scrape_url` (automatisch in chat-context).
- **Geen Jina-key** → native fallback werkt nog steeds.
- **Codebase/env wijzigen** → niet via chat; wel: voorstel aan admin of doorverwijzing `/fumero/code` (developers).

Zie ook: `docs/fumero/scrape-url.md` (Fumero-specifiek).
