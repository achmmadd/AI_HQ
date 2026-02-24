# Omega Singularity — Infrastructuur (meedenken)

**Doel:** Eerst de infrastructuur op orde; data/import en “meer info geven” doen we **later**.

---

## Wat er al is

| Onderdeel | Status | Opmerking |
|-----------|--------|-----------|
| **Run reliability** | ✓ | `launch_factory.sh` start Omega-bridge, heartbeat, dashboard, engineer. `stop_holding.sh` stopt netjes (incl. systemd ExecStop). |
| **24/7 op NUC** | ✓ | systemd user unit `omega-holding.service`; `./scripts/start_24_7.sh systemd`. Optioneel `loginctl enable-linger` voor start na reboot zonder login. |
| **Omega vs Zwartehand** | ✓ | Eén Omega op NUC; Zwartehand apart (`launch_zwartehand.sh`), geen getUpdates-conflict. |
| **Sync naar NUC** | ✓ | rsync-voorbeeld in `WAT_TE_DOEN.md`; evt. `scripts/sync_naar_nuc.sh`. |
| **Mappen Singularity** | ✓ | `holding/marketing`, `holding/marketing/data`, `holding/swarm`, `holding/memory`, `mcp/`. |
| **Swarm-architectuur** | ✓ | CEO-brain, thinking protocol, reflexion; MCP/geheugen nog placeholder. |
| **.env.example** | ✓ | MCP-keys, ChromaDB/Pinecone, Tailscale, E2EE uitgezet; klaar om in te vullen. |
| **Heartbeat** | ✓ | Simpele “ik leef”-log elke 60s. |
| **Dashboard** | ✓ | Streamlit op 8501. |
| **Engineer** | ✓ | Auto-repair daemon. |

---

## Infrastructuur: wat kunnen we nu toevoegen (volgorde om mee te denken)

Hier een **logische volgorde** en keuzes; jij beslist wat eerst.

### 1. MCP echt aansluiten

- **Wat:** Eén of meer MCP-servers (Brave, GitHub, Filesystem, evt. Google) zo configureren dat de **stack** ze kan aanroepen — dus niet alleen Cursor, maar bv. `ai_chat` / swarm.
- **Waarom nu:** Zonder MCP blijft de swarm “droog”; trendrapporten en acties hebben echte tools nodig.
- **Keuze:** Eerst **Brave Search** (trends) en **Filesystem** (lokaal lezen/schrijven) zijn het minst afhankelijk van OAuth; daarna GitHub, dan Google.
- **Later:** Data-invulling en import-pipeline blijven we bewust uitstellen.

### 2. ChromaDB (holding-geheugen) lokaal

- **Wat:** ChromaDB in `data/chromadb` gebruiken voor persistent geheugen (wat de CEO-brain en BU’s “onthouden”).
- **Waarom nu:** Swarm heeft nu alleen een directory; echte read/write naar vectoren maakt rapporten en reflexion sterker.
- **Keuze:** Lokaal ChromaDB = geen extra kosten, past bij NUC. Pinecone kan later als je cloud-geheugen wilt.

### 3. Heartbeat uitbreiden (BU-gezondheid / self-healing)

- **Wat:** Heartbeat niet alleen “ik leef”, maar ook: zijn de daemons er nog, zijn MCP-servers bereikbaar, evt. korte status per BU.
- **Waarom nu:** Dan zie je op één plek (log of dashboard) of de infrastructuur gezond is; eventueel kan de engineer alleen reageren als heartbeat iets meldt.
- **Keuze:** Eerst simpel: lijst processen + “all ok” / “warning”. Later: retry of herstart bij falen.

### 4. Tailscale (zero-trust toegang)

- **Wat:** NUC in Tailnet; alleen via Tailscale bij de NUC/actie-laag kunnen.
- **Waarom nu:** Als de NUC thuis staat en je vanaf Mac of telefoon wilt, is Tailscale een eenvoudige, veilige laag.
- **Keuze:** Optioneel; alleen nodig als je vanaf buiten je thuisnetwerk wilt.

### 5. Dashboard 2.0 (status + gezondheid)

- **Wat:** Dashboard niet alleen “pagina”, maar duidelijke status: Omega/Zwartehand, heartbeat, MCP beschikbaar, laatste swarm-actie, evt. BU-status.
- **Waarom nu:** Maakt “denk mee” makkelijker: je ziet in één oogopslag of alles draait.
- **Keuze:** Kan na 2 en 3; dan heeft heartbeat al de data om te tonen.

### 6. E2EE rapporten (optioneel)

- **Wat:** Rapportjes naar Telegram of export versleuteld met `OMEGA_REPORT_ENCRYPTION_KEY`.
- **Waarom later:** Eerst moet er inhoud zijn (rapporten); daarna versleuteling toevoegen.

---

## Samenvatting volgorde (voorstel)

1. **MCP aansluiten** (Brave + Filesystem eerst) → swarm kan echte acties doen.  
2. **ChromaDB** lokaal → holding-geheugen.  
3. **Heartbeat uitbreiden** → gezondheid + evt. input voor engineer.  
4. **Dashboard 2.0** → status/gezondheid zichtbaar.  
5. **Tailscale** als je externe toegang wilt.  
6. **E2EE** wanneer rapporten gevoelig worden.

**Data/import en “meer info geven”** blijven we bewust **later** doen; eerst deze infrastructuur.

---

## Waar wat staat

- **Starten/stoppen:** `launch_factory.sh`, `scripts/stop_holding.sh`, `scripts/start_24_7.sh`, `scripts/omega-holding.service`
- **24/7 uitleg:** `docs/24_7_RUN.md`
- **NUC-deploy (stappen):** `docs/WAT_TE_DOEN.md`
- **Mandaten / BU Marketing:** `docs/SINGULARITY_MANDATEN.md`
- **MCP-plek:** `mcp/`, `.env.example` (keys)

Als je wilt, kunnen we de volgende stap (bv. “MCP Brave + Filesystem aansluiten” of “ChromaDB in swarm”) concreet uitwerken.
