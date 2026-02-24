# Omega Singularity — High-Level Mandaten & Eerste BU

## Wat is geïnitieerd

- **Mappenstructuur:** `holding/memory`, `holding/swarm`, `mcp/`
- **.env.example:** Uitgebreid met MCP-keys (Brave, GitHub, Google Workspace, ChromaDB/Pinecone, Tailscale, Midjourney/Flux, E2EE)
- **swarm_manager.py:** CEO-brain, thinking protocol (doel → risico → tool), reflexion (max 3 pogingen), `collect_reports()` per BU, `get_ceo_summary()`. Nog geen echte MCP-aanroepen; wel de architectuur om die aan te koppelen.

---

## High-Level Mandaten (wat Jarvis mag/niet mag)

1. **Doel valideren** — Voor elke actie een &lt;thinking&gt; blok: doel, risico’s, gekozen MCP-tool. Geen actie zonder expliciete Safety Check.
2. **Eén CEO-brain** — Alle BU’s rapporteren aan de SwarmManager. Geen losse acties buiten de regie om.
3. **Reflexion** — Bij falen: fout analyseren, corrigeren, opnieuw proberen (max 3×) zonder menselijke tussenkomst.
4. **Proactiviteit** — Elk uur (of gepland) market scan (Brave Search MCP) en voorstellen voor /holding/marketing/.
5. **Zero-trust** — Actie-layer alleen bereikbaar via geautoriseerde nodes (Tailscale). Geen open poorten voor MCP zonder auth.
6. **E2EE rapporten** — Logs/rapporten naar Telegram of dashboard via versleuteld kanaal (OMEGA_REPORT_ENCRYPTION_KEY).

---

## Gekozen: Eerste BU = Marketing

**Focus:** Trendrapporten + aanbevelingen in /holding/marketing/.

**“Winstgevend” voor Marketing =**
- **Omzet** (revenue)
- **Vraag** (hoe hoog is de vraag?)
- **Aanbod** (hoe hoog is het aanbod?)

Jarvis moet deze drie in trendrapporten en aanbevelingen meenemen.

---

## Grenzen: Autonomie vs. toestemming

**Jarvis mag het meeste zelf doen.** Alleen voor **grote dingen** moet hij toestemming vragen (zoals nu al via `request_user_approval` in de Telegram-bot).

**Voorbeelden “groot” (toestemming vereist):**
- Campagnes live zetten of budget boven een drempel (bijv. > €X)
- Contracten of commitment naar derden
- Grote wijzigingen in brand/positioning
- Deploy naar productie of wijzigingen die klanten direct raken

**Zelf doen (geen toestemming):**
- Trendrapporten genereren en in /holding/marketing/ schrijven
- Aanbevelingen doen (omzet/vraag/aanbod)
- Concepten, teksten, schema’s opstellen
- Kleine aanpassingen in bestaande campagnes (binnen grenzen)
- Data verzamelen en analyseren

---

## Meer info en data geven

Je wilt **veel meer info en data** aan het systeem geven. Hier waar en hoe dat kan.

### 1. Vaste plekken in de repo

| Plek | Gebruik |
|------|--------|
| **holding/marketing/** | Strategie, trendrapporten, aanbevelingen, campagnemateriaal. Leg hier bv. `strategie.md`, `trends/`, `campaigns/` aan. |
| **holding/marketing/data/** | Ruwe data: CSV’s, exports (vraag/aanbod, omzet). Jarvis kan deze inlezen voor analyses. |
| **data/notes/** | Notities (ook via Telegram `write_note`). Worden door ai_tools gelezen. |
| **data/tasks/** | Taken (via Telegram of Swarm). |
| **kennisbank/** | Bestaande map voor kennis; ideaal voor lange teksten, PDF’s, documentatie. |
| **holding/memory/** | ChromaDB (vectorgeheugen) komt hier; embeddings van belangrijke docs voor retrieval. |

### 2. Profiel en Brand DNA

- **profile.json** (of **holding/profile.json**): merk, doelgroep, tone-of-voice, doelen (omzet, vraag, aanbod). Jarvis gebruikt dit voor aanbevelingen en voor eventuele auto-assets (Midjourney/Flux).
- Optioneel: **holding/marketing/brand_dna.md** — korte beschrijving merk + richtlijnen.

### 3. Externe bronnen (via MCP of handmatig)

- **Google Sheets / Drive:** omzetcijfers, vraag/aanbod-tabellen. Na koppeling kan Jarvis die inlezen.
- **Brave Search:** market trends (na MCP-koppeling).
- **Eigen CSV/Excel:** in **holding/marketing/data/** zetten; later een import-script of MCP Filesystem.

### 4. Wat je nu al kunt doen

- Bestanden in **holding/marketing/** zetten (strategie, data, rapporten).
- **profile.json** aanmaken met merk + KPI’s (omzet, vraag, aanbod).
- In Telegram notities en taken gebruiken; die komen in data/notes en data/tasks.
- Alles wat in kennisbank/ of docs/ staat kan later geëmbed worden in ChromaDB voor “geheugen”.

### 5. Volgende stap (technisch)

- **Import-pipeline:** script of taak die jouw data (CSV, Sheets-export) naar holding/marketing/data/ of naar ChromaDB sluit, zodat Jarvis erover kan rapporteren (omzet, vraag, aanbod).

---

### Technische volgende stappen (na mandaten)

- MCP-servers daadwerkelijk aansluiten (Brave, GitHub, Filesystem) en in SwarmManager aanroepen.
- ChromaDB (of Pinecone) koppelen voor holding-geheugen; SwarmManager leest/schrijft daar.
- Dashboard 2.0 (Next.js/streamlit-shadcn-ui, live metrics, “Dynamic Island” notificaties).
- Heartbeat uitbreiden: gezondheid BU-processen, bij crash git stash + restart.
- Tailscale integratie voor zero-trust toegang tot de NUC.

---

## Samenvatting

- **Gekozen:** Eerste BU = Marketing (trendrapporten + aanbevelingen). Winstgevend = omzet + vraag + aanbod. Jarvis mag het meeste zelf; alleen grote dingen → toestemming.
- **Klaar:** mapstructuur, .env.example, SwarmManager, mandaten-doc, en sectie “Meer info en data geven”.
- **Jij kunt nu:** data en teksten in holding/marketing/, profile.json, kennisbank/ en data/notes gebruiken; daarna MCP, ChromaDB en import-pipeline uitbouwen.
