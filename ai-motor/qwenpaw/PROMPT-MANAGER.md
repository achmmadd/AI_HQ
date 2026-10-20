# Prompt voor Manager — QwenPaw ↔ bookkeeping (Odoo-leespad)

> Plak dit als opdracht aan de manager (mens of agent). Canonieke infra-brief: [`../docs/qwenpaw-infra-project.md`](../docs/qwenpaw-infra-project.md)

---

Je bent de **manager** van dit project. Eigenaar: Pietje. PR: https://github.com/achmmadd/AI_HQ/pull/14

## Doel

QwenPaw-agent `boka_operations` kan Odoo-facturen lezen via de bookkeeping-bot. Nu: **OFFLINE**. Residual: private `BOOKKEEPING_BOT_URL` vanaf die Docker-container.

## Jouw rol

1. **Wijs toe** aan infra/operator met de brief `ai-motor/docs/qwenpaw-infra-project.md` (of plak `ai-motor/qwenpaw/OPDRACHT-INFRA.md`).
2. **Bewaak scope** — zie “Niet” hieronder. Escalatie naar Pietje bij bind-wijziging of onduidelijke host.
3. **Accepteer alleen met bewijs** (commandoutput, geen “lijkt te werken”).
4. **Rapporteer** kort aan Pietje: klaar / geblokkeerd + wat ontbreekt.

## Al gedaan (niet opnieuw laten doen)

- QwenPaw 2.2.0 live, agent `boka_operations`, skill `project-administratie` + `motor_admin.py odoo`.
- Facturenbron = Odoo via bot `GET /odoo/bills` (zelfde pad als Motor `/bokas/bonnen`).
- Probe weigerde: `127.0.0.1:8001`, `host.docker.internal:8001`, `172.17.0.1:8001`.
- Geen Motor-token. Geen factuurlijsten plakken.

## Infra moet leveren

| # | Deliverable | Bewijs |
|---|---|---|
| 1 | Bookkeeping-bot draait | `curl …/health` JSON |
| 2 | Odoo-leespad op bot | `curl …/odoo/bills?year=2026&quarter=3` (geen secrets) |
| 3 | URL bereikbaar **vanaf QwenPaw-container** | `curl` vanaf die container naar die URL |
| 4 | Console-env | `BOOKKEEPING_BOT_URL` gezet (niet in chat, niet in git) |
| 5 | Acceptatie in QwenPaw | `motor_admin.py probe` + `odoo --year 2026 --quarter 3` niet OFFLINE |

## Niet toestaan

- Odoo-wachtwoord of Motor-token (`MOTOR_API_TOKEN` / `MOTOR_API_URL`) in QwenPaw
- Poort 8001 op internet / Cloudflare
- Approve/boek/write vanuit QwenPaw
- Nieuwe orchestrator, staging-stack, of “NUC verplicht”
- `agent.json` overschrijven / Telegram-token in chat
- Factuurlijsten van Pietje als vervanging voor Odoo

## Klaar-definitie (voor jou)

Project = **klaar** als alle vijf deliverables bewijs hebben én Pietje een korte update krijgt (host + URL-vorm zonder secrets + probe-output).

Project = **geblokkeerd** als de bot niet bestaat/niet start, of alleen op loopback bindt zonder goedgekeurd Tailscale-pad — dan één vraag aan Pietje, geen gok-URL.

## Bronnen

- Infra-brief: `ai-motor/docs/qwenpaw-infra-project.md`
- Runbook: `ai-motor/docs/qwenpaw-migratie.md` (stap 4b)
- ADR-110: `ai-motor/docs/DECISIONS.md`
- Staat: `ai-motor/docs/architecture-2.2/00-HUIDIGE-STAAT.md`
