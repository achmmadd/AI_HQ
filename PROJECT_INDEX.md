# Projectindex — Omega / OpenClaw op de NUC

**Doel:** Eén plek om te zien wat er op de NUC draait en waar de code/docs staan. Handig voor jou en voor AI (Cursor) die meedenkt in deze repo.

---

## Wat dit project is

- **Omega AI-Holding** = Telegram-bridge + dashboard + agent-workers + engineer + resource-warden, draaiend op een NUC.
- **OpenClaw** = de agent-workers die taken uitvoeren (LLM, tools); zij krijgen bewust voldoende CPU/RAM binnen veilige limieten.
- **Stack:** Docker Compose (1Panel-vriendelijk), optioneel `launch_factory.sh` zonder Docker.

---

## Hoe starten/stoppen

| Methode | Start | Stop |
|--------|--------|------|
| **Docker (aanbevolen)** | `docker compose up -d` | `docker compose down` |
| **Met tunnel** | `docker compose --profile with-tunnel up -d` | idem |
| **Zonder Docker** | `./launch_factory.sh` | `./scripts/stop_holding.sh` |
| **24/7 (systemd)** | `./scripts/start_24_7.sh systemd` | Zie `docs/24_7_RUN.md` |

---

## Containers / processen → code

| Service | Container/process | Hoofdbestand |
|---------|-------------------|--------------|
| Telegram-bridge | omega-telegram-bridge | `telegram_bridge.py` |
| Dashboard (Mission Control) | omega-mission-control | `dashboard.py` (Streamlit, poort 8501) |
| Agent-workers (OpenClaw) | omega-agent-workers | `scripts/agent_workers.py` |
| Heartbeat | omega-heartbeat | `heartbeat.py` |
| Resource-warden | omega-resource-warden | `resource_warden.py` |
| Engineer | omega-engineer | `scripts/engineer_daemon.py` |
| Tunnel + watcher | omega-cloudflared, omega-tunnel-watcher | `scripts/tunnel_watcher.py` |

---

## Belangrijke mappen

| Pad | Betekenis |
|-----|-----------|
| `holding/` | Data, output, agents (o.a. SOUL.md per agent), swarm, marketing |
| `holding/data` | Persistente data (o.a. ChromaDB als je die gebruikt) |
| `holding/output` | Uitvoer van agents/rapporten |
| `mcp/` | MCP-servers/configuratie |
| `evomap/` | AI-Holding Evomap — realtime agent-dashboard (Next.js + FastAPI). Bij tunnel/externe toegang: `EVOMAP_API_URL` in .env (Omega + seed); `NEXT_PUBLIC_WS_URL` bij build (frontend). Volumes: evomap_data, evomap_logs. |
| `docs/` | Documentatie (NUC, 1Panel, Singularity, checklists) |
| `scripts/` | Shell- en Python-scripts (start, stop, tunnel, sync, debug) |
| `logs/` | Logbestanden (vaak ook in Docker volumes) |

---

## Belangrijke bestanden (root)

| Bestand | Doel |
|---------|------|
| `docker-compose.yml` | Stack-definitie; resource-limieten o.a. voor agent-workers |
| `.env` | TELEGRAM_BOT_TOKEN, GOOGLE_API_KEY, evt. OPENAI/Ollama (niet in git) |
| `.env.1panel` | Optioneel: 1Panel API voor resource-warden |
| `system_specs.md` | CPU, RAM, schijf van de NUC + resourcebeleid OpenClaw |
| `PROJECT_INDEX.md` | Deze index |

---

## Documentatie (docs/)

| Doc | Inhoud |
|-----|--------|
| `docs/INFRASTRUCTUUR.md` | Overzicht infrastructuur, “waar wat staat”, volgorde van uitbreidingen |
| `docs/OMEGA_OP_NUC.md` | Omega draaien op de NUC |
| `docs/INSTALL_NUC.md` | Installatiestappen NUC |
| `docs/1PANEL_INTEGRATIE.md` | 1Panel-integratie |
| `docs/24_7_RUN.md` | 24/7 draaien (systemd, linger) |
| `docs/START_CHECKLIST.md` | Checklist voor start |
| `docs/WAT_TE_DOEN.md` | Wat te doen (o.a. sync naar NUC) |
| `docs/WAT_NODIG.md` | Wat er nodig is |
| `docs/SINGULARITY_*.md` | Singularity, mandaten, 1Panel |

---

## Wat je voor AI/Cursor makkelijker kunt maken

1. **Deze index gebruiken** — Verwijs in vragen naar `PROJECT_INDEX.md` of “kijk in de projectindex”; dan weet de AI waar hij moet zoeken.
2. **Workspace = AI_HQ** — Zorg dat Cursor met deze map als workspace open staat, dan kan hij alle bestanden en de index zien.
3. **Optioneel: Cursor rule** — In `.cursor/rules/` een korte regel zoals: “Dit is de Omega/OpenClaw-stack op een NUC; zie PROJECT_INDEX.md en system_specs.md voor overzicht en resources.”

Als je wilt, kan ik een concrete Cursor-rule voor dit project voorstellen of aanmaken.
