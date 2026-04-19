# AI Motor — Builder sprint (referentie)

## DEEL 2 — Dify code template

Zie bestand: `factory-os/prompts/app-builder-template.md` (wordt door `/api/builder` ingelezen).

## DEEL 4 — Dynamische app-pagina

- Route: `app/apps/[slug]/page.tsx`
- Leest `naam`, `slug`, `code` direct uit SQLite (`custom_apps`), geen HTTP self-call.
- Rendering: client component met `iframe` + `srcDoc` (Tailwind + React + ReactDOM + Babel CDN), sandbox `allow-scripts`.
- Zie: `components/custom-app-preview.tsx`

## Database

- Tabel `custom_apps`: `lib/db/database.ts` → `initDb()` / `CREATE TABLE IF NOT EXISTS custom_apps (...)`.
