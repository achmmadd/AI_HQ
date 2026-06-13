# Fumero Studio — status

**Versie:** v1 (juni 2026) — **compleet voor productie**

## Wat is live

| Onderdeel | Route / pad |
|-----------|-------------|
| Max chat | `/fumero/chat` |
| Content Studio | `/fumero/photo-studio` |
| Automations | `/fumero/automations` |
| Bouwen (coder) | `/fumero/bouwen` |
| Bibliotheek | `/fumero/bibliotheek` |
| Projecten hub | `/fumero/projecten` (Website · Widget · Team) |
| Orders | `/fumero/orders` |

Legacy redirects: `/fumero/apps`, `/fumero/tools` → Projecten; `/fumero/chat?mode=coder` → Bouwen.

## v1 scope (afgerond)

- Navigatie (7 routes), Projecten hub, Bouwen-shell met preview & publish
- Design-builder context, Geavanceerd-paneel, project-runtime (html / react / full_app)
- UX-check voor HTML-tools; vriendelijke melding voor full_app / react
- Team-tab placeholder (NL)
- pm2 `ai-motor` op motorsai.app

## Platform (wrap-ready)

- **URL Reader** (`lib/scrape/`) — tenant whitelist + provider `auto|jina|native`. Zie `docs/platform/url-reader.md`.

## Post-v1 backlog

- React HMR sandbox in preview
- Team-auth en gedeelde team-apps
- UX-review voor full-stack apps (nu tool/HTML-only)
- Verdere Content Studio sprint-items (zie `docs/DESIGN-SPEC-content-studio.md`)
- Campaign Agency / Content Department roadmap → [`docs/MOTOR-CONTENT-DEPARTMENT-ROADMAP.md`](../MOTOR-CONTENT-DEPARTMENT-ROADMAP.md)
