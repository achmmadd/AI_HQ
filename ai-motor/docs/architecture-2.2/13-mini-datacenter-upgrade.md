# 39. Mini-datacenter-upgrade — wat het derde niveau ontgrendelt

> Aanvulling op [Motor AI 2.2](README.md) en [doc 12](12-hardware-3090.md). Datum: 2026-07-21.
> Topologie: **NUC (orchestrator/control) + inference-PC (Ryzen 7 / 32 GB / RTX 3090, execution) + Hetzner 16 GB (data + zwaar)**, via Tailscale. Dat is functioneel een mini-datacenter: gescheiden control/execution/data over drie nodes, precies de planes-indeling uit §15 — maar nu fysiek.

---

## 39.1 Eerst de discipline: wat er NIET verandert

Een mini-datacenter is capaciteit, geen vrijbrief. Deze regels blijven onverkort gelden:

1. **Postgres op Hetzner blijft de enige SSOT** (§16). De inference-PC krijgt géén databases met waarheid.
2. **Eén canonieke engine** (ADR-101), één orchestrator. Meer hardware ≠ meer orchestrators.
3. **Production Core blijft klein** (§28). Elke nieuwe service op de PC vereist een lifecycle-rij, eigenaar en runbook — anders is het een experiment op de Watchlist.
4. **De Bokas-pilot-gates (§32) blijven de maat.** Capaciteit versnelt de uitvoering, niet de bewijsperiodes.
5. **De 30-dagen-regel blijft:** geen tweede complexe divisie vóór de eerste 30 dagen groen is.

De les uit al het onderzoek (mini-SWE-agent, Azië-scan §37.1): het next level is operationele volwassenheid. Het mini-datacenter maakt die volwassenheid *goedkoper en sneller bereikbaar* — dat is de upgrade.

## 39.2 Wat het derde niveau wél ontgrendelt (zeven upgrades)

### U1 — Parallelle sandbox-vloot → de Codex-werkwijze wordt haalbaar

De Ryzen 7 + 32 GB is ruim genoeg voor **3–5 gelijktijdige geïsoleerde task-sandboxes** (Docker, per-taak worktree) naast de inference-load. Daarmee wordt het Codex-patroon (PC-01: veel parallelle, goed afgebakende taken vanaf één board) praktisch uitvoerbaar in plaats van theoretisch:

- masterplan-gap #7 ("multi-file repo-agent ❌") wordt: coding-CLI in sandbox × N parallel;
- elke sandbox: eigen worktree, eigen branch, lint-gate, bewijs-artifacts, PR — mens reviewt outcomes.
- **Golf-inpassing:** Golf 3 (stond al gepland; capaciteit was de bottleneck, die is weg).

### U2 — De nachtploeg: autonome shifts terwijl je slaapt

Het Anthropic long-running-harnas (§18) + batch-economie (doc 11 A4) + lokale stroom i.p.v. tokens = een **dagelijkse autonome nachtcyclus**:

```
23:00  ingest-batch (MinerU-parsing, embeddings, transcripties)   → inference-PC
00:00  doc-gardening-agent (stale docs, fix-PR's — Codex-patroon) → sandbox
01:00  1–2 long-running increments (feature_list.json, checkpoint) → sandboxes
05:00  eval-runs op gewijzigde Playbooks/prompts                  → lokaal + judge
06:30  dagbrief-voorbereiding (queries, anomaliedetectie, concept) → engine + lokaal
07:30  ochtendrapport in Telegram: wat is gedaan, bewijs, wat wacht op approval
```

Alles binnen Gateway-policies en budgetten; R2+-acties blijven 's nachts geblokkeerd (wachten op ochtend-approval). Dit is de "engineers working in shifts"-metafoor van Anthropic, letterlijk gemaakt — en het is de snelste route naar §35-criterium 15 (autonome taakduur).
**Golf-inpassing:** eerste versie in Golf 2 (alleen ingest + briefvoorbereiding), volledig in Golf 3.

### U3 — Evals worden bijna gratis → strakkere gates zonder frictie

Het duurste bezwaar tegen frequente eval-runs (tokens) vervalt voor het gros van de checks: judge-runs voor R0/R1-taken en regressiesets draaien op `local.chat`/`judge.local`. Consequentie: **eval-frequentie omhoog** — bij elke Playbook-wijziging én wekelijks als drift-detectie, niet alleen bij promoties. Cloud-judge blijft voor kalibratie (maandelijkse steekproef vergelijkt lokale vs cloud-judge-scores).
**Golf-inpassing:** Golf 2, samen met de eerste eval-set.

### U4 — PII-volledig-lokale Playbooks: een nieuwe klasse werk

Met `local.vision`/`local.extract` (doc 12) kan een categorie Playbooks die eerder principieel lastig was: **personeelsdata, loonstroken, medische verzuimcorrespondentie, contracten, financiële details** — alles waarvoor zelfs EU-cloud-routing een AVG-gesprek was. De Gateway-policy krijgt een dataklasse `pii-strict` → alleen `local.*`-routes toegestaan, geen fallback naar cloud (wachtrij bij uitval).
**Golf-inpassing:** policy in Golf 2; eerste pii-strict Playbook (bijv. personeels-/contractadministratie) in Golf 3–4.

### U5 — Echte staging-omgeving

§17 definieerde "staging = tweede compose-stack" zonder plek. Die plek is er nu: **staging-stack op de inference-PC** (Motor-app + engine + kopie-DB met synthetische/gemaskeerde data). Daarmee worden migraties, Playbook-promoties en modelwissels toetsbaar vóór productie — en de maandelijkse restore-test (§27) krijgt een vast doelwit: restore náár staging is meteen de oefening.
**Golf-inpassing:** Golf 2 (restore-test-doelwit), volwaardig in Golf 3.

### U6 — Derde backup-locatie: 3-2-1 wordt compleet

NVMe/HDD op de inference-PC = tweede on-site kopie naast Hetzner; Storage Box/B2 = off-site. Daarmee is 3-2-1 (doc 10 O4) volledig: PG-dumps en Qdrant-snapshots nightly naar de PC (pull via Tailscale, append-only), off-site wekelijks+. RPO kan van 24u naar 15 min zonder extra kosten.
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

- **Criterium 7 (kosten/succesvolle taak):** verwacht een structurele daling voor extractie-/batch-klasse taken (stroom ≈ €0,05–0,10/uur onder last vs token-kosten). Meet lokaal vs cloud per Playbook — dit wordt het eerste harde bewijs van de hardware-investering.
- **Criterium 15 (autonome taakduur):** de nachtploeg (U2) is de motor; verwacte progressie van "1 increment/nacht" naar "meerdere parallelle increments/nacht" (U1) binnen twee kwartalen — mits criteria 1–3 groen blijven.
- **Criterium 5/6 (herstelbaarheid/dataverlies):** U5+U6 maken de doelen (RTO 4u, RPO 15 min) haalbaar zonder nieuwe kosten.
- **Nieuw sub-criterium (bij 7):** GPU-benutting 's nachts ≥ X% (anders is de nachtploeg te leeg gepland of de box overbodig groot) — baseline eerst, norm na 30 dagen.

## 39.4 Samengevat: het stappenpad

| Niveau | Wat | Status |
|---|---|---|
| 1. Starter kit | chat + RAG + n8n (waar we vandaan komen) | ✅ bestaat |
| 2. Operationele volwassenheid | lifecycle, Gateway, Playbooks, evals, één waarheid (2.2-kern, doc 01–09) | Golf 0–2, in uitvoering |
| **3. Mini-datacenter** | **parallelle sandboxes, nachtploeg, gratis evals, pii-strict Playbooks, staging, 3-2-1** | **dit document; Golf 2–3** |
| 4. Productfabriek | Playbooks tenant-shared, RaaS-pricing, New-API-billing (doc 10 §36.4, doc 11 Z4/B2) | Golf 4, ná 30 dagen groen |

Niveau 3 is geen nieuw project naast de golven — het zijn zeven upgrades die **binnen** de bestaande golven landen en vooral Golf 2–3 sneller en goedkoper maken. De volgorde blijft heilig: eerst Golf 0/1 (security, één waarheid, engine), dan pas draait de nachtploeg.
