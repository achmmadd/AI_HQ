# Motor bouwen — QR-menu, HTML, grotere apps

Waarom **Codex/Cursor** vaak beter voelt dan Motor-chat voor je Bokas QR-menu — en hoe je Motor wél inzet.

## Drie paden in MotorsAI

| Pad | Wanneer | Preview | Bestand op schijf |
|-----|---------|---------|-------------------|
| **Chat** (OpenClaw) | Vragen, diagnose, plan | Nee | Nee — alleen tekst in chat |
| **Artifact** | Eén HTML-app (QR-menu, widget) | Ja, rechts | Opslaan als app |
| **Project** | Voorraad, personeel, React/Next | Ja, multi-file | In DB + export |

Chat ≠ bouwen. Als je “menu voor Bokas” typt zonder de juiste woorden, krijg je **proza of mock code in chat** — geen preview.

## Waarom Bokas QR-menu misliep

1. **Verkeerde route** — “bokas” + “menu” triggert **project-build** (groot), niet één HTML-bestand. Dat is zwaarder en vraagt Anthropic/Dify/n8n.
2. **Dify niet geconfigureerd** — `/api/artifact/generate` geeft 503 zonder `DIFY_API_KEY` → geen preview-paneel.
3. **OpenClaw = chat-first** — geen directe edit van `menu.html` op schijf zoals Codex in je repo.
4. **Motor-discipline** — mock doctor/HTML-dashboards worden tegengehouden (goed voor infra, verwarrend als je “doctor UI” vroeg).
5. **Codex/Cursor** — werken op **echte bestanden** in je workspace; Motor chat streamt alleen.

## Zo bouw je het QR-menu wél in Motor

### Prompt (copy-paste)

```text
Maak één HTML-bestand: digitaal QR-menu voor Bokas restaurant.
- Hash-routing (#/drank, #/gerechten)
- Mobile-first, donker thema
- Geen aparte .html bestanden; alles in één document
- Toon preview via artifact build
```

Woorden die helpen: **maak**, **één html**, **qr menu**, **menukaart**.

### Checklist

1. `node scripts/smoke-quality.mjs` → Dify/ builder groen?
2. Chat op **bokas** klant
3. Preview-paneel rechts moet openen (artifact)
4. Iteratie: “zet prijzen groter”, “voeg sectie desserts toe”

### Als preview niet opent

```bash
curl -s https://motorsai.app/api/smoke-production | jq '.features.dify_builder_configured'
```

`false` → zet in PM2 env: `DIFY_API_KEY` (+ optioneel `DIFY_BASE_URL`), rebuild, restart.

## Grotere apps (voorraad, personeel)

| Fase | Tool | Waarom |
|------|------|--------|
| Nu (prototype) | Codex/Cursor in repo | Snel multi-file, git, deploy |
| Motor project-build | Chat → project preview | Als `ANTHROPIC_API_KEY` of Dify ok |
| Later (productie) | MotorsAI + OpenClaw agent + `/dev` | Geautomatiseerd op NUC, met goedkeuring |

Realistische volgorde:

1. **QR-menu** — artifact (één HTML) of Codex tot het staat  
2. **Voorraad MVP** — Next/SQLite in repo (Codex), Motor voor vragen/reviews  
3. **Personeelsapp** — project-build of aparte repo; Motor voor planning/chat  

Motor is nu sterk in **chat + discipline + school**; **multi-file productie-apps** zijn nog Cursor-niveau (zie `WORLD_CLASS_CHECKLIST.md` #7).

## Kwaliteit controleren

```bash
cd AI_HQ/ai-motor
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build && pm2 restart ecosystem.config.cjs --update-env
node scripts/smoke-quality.mjs
REQUIRE_BUILDER=1 MOTORSAI_TOKEN=… node scripts/smoke-quality.mjs
```

## Wanneer welke tool

| Taak | Motor | Codex/Cursor |
|------|-------|--------------|
| OpenClaw fix, stack | ✓ | |
| QR-menu HTML iteratie | ✓ (artifact + Dify) | ✓ (bestand) |
| Voorraad/personeel v1 | project (experimenteel) | ✓ aanbevolen |
| Git, CI, deploy | beperkt | ✓ |
