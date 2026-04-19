# Handoff — volgende AI / operator

Gebruik dit als korte context bij een nieuwe sessie of bij troubleshooting.

## Primaire testflow (Fumero dashboard)

Stap-voor-stap handleiding met exacte prompt:

- **`factory-os/docs/EERSTE_APP_FUMERO_DASHBOARD.md`**

## Kernbestanden (ai-motor)

| Onderdeel | Pad |
|-----------|-----|
| Builder UI | `ai-motor/app/builder/page.tsx` |
| Builder API | `ai-motor/app/api/builder/route.ts` |
| App preview (iframe, sandbox) | `ai-motor/components/custom-app-preview.tsx` |
| Dynamische app-route | `ai-motor/app/apps/[slug]/page.tsx` |
| DB init + `custom_apps` | `ai-motor/lib/db/database.ts` |
| Code-template voor Dify | `factory-os/prompts/app-builder-template.md` |
| Auth / publieke routes | `ai-motor/middleware.ts` (o.a. `/api/chat`, `/apps/<slug>` preview publiek) |

## Auth

- **`/api/builder`** vereist ingelogde sessie (`motorsai_token` cookie na `POST /api/auth/login` met `MOTORSAI_PASSWORD`).  
- **`curl`-test:** login met `-c cookies.txt`, builder met `-b cookies.txt`.  
- Wachtwoord staat op de server in `ai-motor/.env.local` als `MOTORSAI_PASSWORD`.

## QA

```bash
bash ~/AI_HQ/scripts/qa_grondig.sh
```

Log onder `~/AI_HQ/logs/qa/`. Script gebruikt veilige `.env`-parse en SQLite via Python als `sqlite3` CLI ontbreekt.

## Deploy (typisch)

```bash
cd ~/AI_HQ/ai-motor && npm run build && pm2 restart ai-motor
```

## Bekende aandachtspunten

- Publieke `/apps/<slug>`-URLs zijn bewust deelbaar; API’s onder `/api/apps` blijven achter login.  
- Builder hangt af van Factory OS / n8n / Dify; bij lange builds logs daar checken.  
- Iframe sandbox: `allow-scripts allow-same-origin` in `CustomAppPreview` (React + Babel in `srcDoc`).
