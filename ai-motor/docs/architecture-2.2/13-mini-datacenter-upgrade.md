# 39. Mini-datacenter-upgrade — wat het derde niveau ontgrendelt

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Topologie: **NUC (kanaal/UI/glue, informeel orchestrator) + Hetzner (data + durable engine/Kernel/Gateway) + inference-PC (stateless execution)** via Tailscale.

---

## 39.1 Eerst de discipline: wat er NIET verandert

Een mini-datacenter is capaciteit, geen vrijbrief. Deze regels blijven onverkort gelden:

1. **Postgres op Hetzner blijft de enige SSOT** (§16). De inference-PC krijgt géén databases met waarheid.
2. **Eén durable engine op Hetzner** (ADR-101/108). De NUC heet alleen informeel orchestrator.
3. **Production Core = maximaal acht**; de inference-PC blijft Incubation.
4. **Vijf actieve criteria** (#1, #2, #3, #7, #16); overige metingen zijn observaties.
5. **Dertig dagen groen** begrenst autonomiepromotie en AM-1-scope-ontdooiing, niet de start van nieuw A1-werk.

De les uit al het onderzoek (mini-SWE-agent, Azië-scan §37.1): het next level is operationele volwassenheid. Het mini-datacenter maakt die volwassenheid *goedkoper en sneller bereikbaar* — dat is de upgrade.

## 39.2 Wat het derde niveau wél ontgrendelt (zeven upgrades)

### U1 — Parallelle sandbox-vloot — bevroren

AM-1 bevriest de sandbox-vloot. Na ontdooiing vereist elk sandboxslot een engine-resource-lease met timeout; tot dan geen parallel programma op de PC.

### U2 — Nachtwerk — alleen ingest-batch

Tot Playbook #1 dertig dagen groen is, is alleen een ingest-batch toegestaan. Daarna start nachtwerk met **exact één increment per nacht**. Volledige rapportage staat in Motor UI; Telegram stuurt alleen een link. Gemiddelde ochtendreview moet ≤20 minuten over 14 dagen blijven, anders terug naar ingest-only.

### U3 — Evals worden goedkoper; geen extra harde gates

Routes `chat.fast` en `judge` kunnen later tier `local` gebruiken. Dit verlaagt kosten, maar maakt geen nieuwe harde gate: tot drie Playbooks productie draaien blijven twaalf criteria observaties.

### U4 — Art. 9-werk — uitgesteld tot na DPIA

Lokale inference lost grondslag, doelbinding en DPIA niet op. Geen Playbook op loonstroken, verzuim of andere bijzondere persoonsgegevens vóór DPIA en grondslaganalyse. `pii-strict` gebruikt tier `local` en traceert geen content.

### U5 — Restore-test naar wegwerp-container

Een vaste staging-stack is bevroren. Voor restore-tests volstaat een tijdelijke container met synthetische/gemaskeerde data; engine/Kernel/Gateway blijven op Hetzner en draaien nooit permanent op de inference-PC.

### U6 — Derde backup-locatie: 3-2-1 wordt compleet

NVMe/HDD op de inference-PC kan een extra kopie dragen nadat opslag is bevestigd. Nightly pulls geven **RPO 24 uur**. RPO 15 minuten vereist apart besloten WAL-shipping; dat is niet gratis of impliciet.
**Golf-inpassing:** Golf 1–2 (klein, hoge waarde).

### U7 — Eerder afgewezen zwaargewichten krijgen een voorwaardelijke plek

Sommige "Rejected/Watchlist wegens RAM"-besluiten krijgen een nieuwe voorwaarde (géén automatische promotie — lifecycle-regels §28 gelden):

| Component | Was | Wordt |
|---|---|---|
| RAGFlow | Rejected (wilde 16 GB voor zichzelf) | Watchlist met concrete optie: kan op de PC als een documentzware tenant landt — maar pas ná MinerU+LightRAG-pad bewezen tekortschiet |
| Coze Loop | Watchlist (3–4 GB te zwaar naast alles) | Watchlist, drempel verlaagd: past op de PC als Langfuse-evals aantoonbaar tekortschieten |
| vLLM | Trigger-based | idem; trigger (5+ gelijktijdige runs) wordt door U1/U2 eerder geraakt — meten |
| Groter lokaal model (64 GB RAM-upgrade) | n.v.t. | Blijft trigger-based: alleen als een eval aantoont dat de 14–32B-klasse een concrete taak mist |

## 39.3 Wat dit betekent voor de 11/10-criteria

- **Actief criterium #7:** meet stroom+cloudkosten per succesvolle taak; geen aanname dat lokaal gratis is.
- **Observatie #15:** maximaal één increment/nacht na ontdooiing; geen groei naar een vloot zonder nieuw besluit.
- **Observaties #5/#6:** restore naar wegwerp-container; RPO 24 uur bij nightly, 15 minuten alleen met WAL.
- **GPU-benutting:** observatie zonder gate-status.

## 39.4 Samengevat: het stappenpad

| Niveau | Wat | Status |
|---|---|---|
| 1. Starter kit | chat + RAG + n8n (waar we vandaan komen) | ✅ bestaat |
| 2. Operationele volwassenheid | lifecycle, Gateway, Playbooks, evals, één waarheid (2.2-kern, doc 01–09) | Golf 0–2, in uitvoering |
| **3. Mini-datacenter** | **stateless inference-worker + extra backupdoel** | Incubation; geen taken vóór SSH+Gateway/policy |
| 4. Betalende pilot | één klant uit eigen netwerk, hands-on, zonder SLA | Golf 4; productfabriek pas daarna |

Niveau 3 is capaciteit, geen parallel programma. Eerst Golf 0, daarna K2/K1 en maximaal één architectuurdag per week. De inference-PC blijft idle voor productietaken tot SSH, runbook en Gateway/policy staan.
