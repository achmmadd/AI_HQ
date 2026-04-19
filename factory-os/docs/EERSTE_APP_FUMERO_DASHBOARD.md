# Eerste app bouwen — Fumero dashboard

**Doel:** Een echte Fumero-app bouwen om het systeem te testen  
**Tijd:** ~5 minuten  
**Resultaat:** Live app op `motorsai.app`

---

## Stap 1 — Inloggen

1. Open: https://motorsai.app/login  
2. Wachtwoord: jouw `MOTORSAI_PASSWORD` (zoals in `ai-motor/.env.local` op de server)  
3. Klik **Inloggen**

Je komt op het home-dashboard.

---

## Stap 2 — Naar Builder

1. Klik in de sidebar: **Live Builder**  
2. Je ziet o.a.:
   - Promptveld  
   - Demo-prompts als chips  
   - Tabs: **Builder** / **Mijn Apps**

---

## Stap 3 — App bouwen

**Prompt (exact kopiëren):**

```
Een Fumero bestellingen dashboard met:

1. Overzicht vandaag (aantal orders, totaal €, top product)
2. Recent orders tabel (5 meest recente)
   - Order ID, product, prijs, tijd
   - Status badge (nieuw/verzonden/afgerond)
3. Populaire producten chart (top 5)
   - Balkgrafiek met aantal verkocht
4. Snelle acties:
   - Filter op vandaag/week/maand
   - Export naar CSV knop
   - Nieuwe bestelling knop

Gebruik Fumero kleuren:
- Achtergrond: donker (bg-slate-900)
- Cards: bg-slate-800
- Primary kleur: groen (#22c55e)
- Badges: groen voor afgerond, blauw voor nieuw, oranje voor verzonden

Data: gebruik mock data (10 recente orders)
```

**Acties:**

1. Plak de prompt in het tekstveld  
2. Klik **Bouw app**  
3. Wacht 60–90 seconden  

**Verwacht:**

- Voortgang (Factory OS → Dify → validatie → opslaan → live)  
- Melding dat de app live is  
- Knop **Bekijk app**

---

## Stap 4 — App testen

1. Klik **Bekijk app**  
2. Nieuwe tab: `https://motorsai.app/apps/<slug>`  
3. Controleer het dashboard  

**Checklist:**

- [ ] Dashboard laadt zonder errors  
- [ ] Secties zichtbaar (stats, tabel, chart)  
- [ ] Knoppen klikbaar  
- [ ] Kleuren (donker thema, groen accent)  
- [ ] Mock orders zichtbaar  

**Als iets niet werkt:**

1. Browser DevTools (F12) → **Console**  
2. Screenshot bij errors  
3. `/builder` → **Mijn Apps** → app verwijderen indien nodig  
4. Opnieuw proberen met aangepaste prompt  

---

## Stap 5 — Itereren

Een nieuwe prompt maakt een **nieuwe app** (de oude blijft bestaan), bijvoorbeeld:

```
Pas het Fumero dashboard aan:
- Maak de chart groter (h-64)
- Voeg een zoekbalk toe boven de tabel
- Toon ook totaal omzet vandaag in grote cijfers
```

---

## Veelvoorkomende problemen

| Probleem | Oorzaak | Fix |
|----------|---------|-----|
| Leeg / zwart scherm | Codegeneratie mislukt | Mijn Apps → verwijderen → opnieuw |
| Build > 2 min | Dify/n8n druk | Wachten of pagina verversen |
| 401 Unauthorized | Sessie verlopen | Uitloggen → opnieuw inloggen |
| Chart laadt niet | CDN traag | Even wachten, verversen |

---

## Na deze test

**Als het werkt:** builder, opslag in SQLite en preview op `/apps/[slug]` zijn in lijn.

**Als het niet werkt:**

1. `pm2 logs ai-motor --lines 50`  
2. `docker logs n8n --tail 50`  
3. `docker logs docker-api-1 --tail 50` (Dify API-container)  
4. `bash ~/AI_HQ/scripts/qa_grondig.sh`  
5. Log + screenshot meegeven aan de volgende AI  

---

## Alternatieve testprompts

**Simpel:**

```
Een simpele calculator met +, -, ×, ÷ knoppen
```

**Medium:**

```
Een todo app met donker thema en localStorage
```

**Complex:**

```
Een Bokas reserveringssysteem met:
- Kalender (week view)
- Tijdslots (09:00-17:00)
- Formulier (naam, personen, tijd)
- Bevestiging na submit
```

Start simpel → test → daarna complexer.

---

## Tips voor betere apps

1. **Layout:** concreet (kolommen, volgorde), niet alleen “een dashboard”.  
2. **Kleuren:** hex + Tailwind-klassen (`#22c55e`, `bg-slate-900`, …).  
3. **Data:** bv. “10 mock orders met realistische namen en prijzen”.  
4. **Interactie:** wat moet elke knop doen (filter, CSV, …).

---

## Succescriteria

- [ ] Build binnen ~90 seconden  
- [ ] App op `motorsai.app/apps/[slug]`  
- [ ] UI-elementen zichtbaar en klikbaar  
- [ ] Styling volgens prompt  
- [ ] Geen kritieke console-errors  

---

**Volgende stap voor een andere AI:** zie `HANDOFF_VOLGENDE_AI.md` in de repo-root (`AI_HQ`).
