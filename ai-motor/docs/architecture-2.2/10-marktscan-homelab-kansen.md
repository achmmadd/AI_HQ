# 36. Marktscan — homelab/self-hosted AI-markt 2026 en aansluitende kansen voor Motor AI

> **Eigenaar:** Pietje · **Geconsolideerd:** 2026-07-27
> Aanvulling op [Motor AI 2.2](README.md), onderzoek uitgevoerd 2026-07-21. AM-1 bevriest uitbreidingen; AM-2 zet K2 vóór K1.

---

## 36.1 Hoofdconclusie

**De Motor AI-stack is de marktstandaard, geen buitenbeentje.** n8n + Ollama + Qdrant + Postgres + cloud-routing op Docker Compose is vrijwel identiek aan het officiële n8n Self-hosted AI Starter Kit-patroon waar de community in 2025–2026 op convergeerde (E4). De achterstand zit niet in de stack maar in: (a) use-cases erbovenop, (b) ops-discipline (updates, secrets, monitoring, backups), (c) één acute deadline (EU AI Act Art. 50, 2 aug 2026).

## 36.2 Nieuwe kansen — geprioriteerd

Statussen sluiten aan op de [technology-lifecycle-matrix (§28)](07-lifecycle-en-traceability.md).

### Tier 1 — Adopt/Configure (bewezen patroon, hoge waarde, past in RAM-budget)

| # | Kans | Tools | Bewijs | RAM | Waarde |
|---|---|---|---|---|---|
| K1 | **Bonnetjes/factuur → Moneybird v1** (cloud-vision → validatie → concept-boeking → elke boeking handmatig approven) | Bestaande stack + route `extract` (cloud-tier) + Moneybird API | E1/E4 | ~0 extra voor v1 | Playbook #2, week 2–4; lokale tier pas later |
| K2 | **Review-response-automation Bokas** | Bestaande n8n + Telegram-notificatie/deeplink naar Motor UI | E1 | ~0 | Playbook #1, week 1–2; bewust wegwerp, migratie week 6–9 |
| K3 | **Concurrent-/prijs-/webmonitoring → dagbrief** | changedetection.io (~25k stars) + LLM-diff-samenvatting | E1/E4 | ~0,5 GB | Middel-hoog, beide tenants; voedt de Bokas-brief (§32) |
| K4 | **Anomaliedetectie + forecast op omzet in de dagbrief** | statsforecast (prediction intervals; v2.1 jul 2026) + vaste SQL + LLM-narratie | E1 — statistiek detecteert, LLM vertelt (anti-hype-ontwerp, conform §19-beslisboom: deterministisch waar het kan) | ~0 | Hoog voor Bokas-ops |
| K5 | **Infra-log-triage → digest** | logs → filter → UI-digest; Telegram alleen kritieke metadata+link | E5 | ~0 | Middel; solo-operator-verzekering |

### Tier 2 — Ops-verbeteringen (direct, klein, sluit aan op §26–27)

| # | Verbetering | Detail | Bewijs |
|---|---|---|---|
| O1 | **Container-updates: Watchtower vervangen** | containrrr/watchtower gearchiveerd 2025-12-17 → Renovate-PR's tegen compose-files in git (past bij GitOps/doc-CI) of Diun (notify-only). Nooit blind auto-updaten op businesskritieke stacks | E1 |
| O2 | **Secrets: sops + age** | Encrypted values in git, geen extra server; bevestigt §16-keuze. Infisical pas bij meerdere operators | E5 (consensus) |
| O3 | **Monitoring: Beszel + Uptime Kuma** | Hub op Hetzner; agents op NUC/inference-PC; alerts als metadata+link | E4/E5 |
| O4 | **Backup: restic/Borg 3-2-1 + push-monitor** | Stille backup-failure = alert (healthchecks-patroon); versterkt de restore-test-discipline uit §27 | E1 |
| O5 | **Embeddings-upgrade** | Embeddingwissel = volledige re-index; reranker blijft bevroren door AM-1 en is later een pipeline-service, geen route | E4 |
| O6 | **NUC-RAM** | Geen prioriteit: de 3090-PC draagt lokale inference; alleen upgraden bij gemeten NUC-geheugendruk | E4/E5 |
| O7 | **Compose-beheer: Komodo** (Watchlist) | Multi-server compose-management met git-webhook-deploys over NUC + Hetzner; lichte Portainer-vervanger | E4 |
| O8 | **SearXNG (+ Crawl4AI op Hetzner)** | Private zoek-/scrape-laag voor agents zonder per-call-API-kosten; via MCP aan harnesses koppelen | E4 |
| O9 | **Scriberr (Whisper-transcriptie)** (Incubation) | Meeting-/gesprekstranscriptie → samenvatting → Qdrant; folder-watcher speciaal voor n8n-pipelines | E4 |

### Tier 3 — Defer / voorwaardelijk

| # | Kans | Voorwaarde |
|---|---|---|
| D1 | **WhatsApp-klantcontact Bokas** | Alléén officiële Cloud API (per-conversation-pricing). Onofficieel (Baileys/Evolution/WAHA) = gedocumenteerd verhoogd banrisico 2025–2026 → **Rejected** voor productie; Telegram blijft intern kanaal |
| D2 | **Website-chat met RAG** | Typebot (deterministische flows: reservering/FAQ) + eigen Qdrant-RAG-fallback; Chatwoot alleen bij omnichannel-behoefte (Captain = betaald). Vereist Art. 50-disclosure vóór livegang |
| D3 | **Telefonie-voice-agent** | LiveKit Agents is bewezen framework, maar SIP/WebRTC-zelfbouw is te veel bewegende delen voor deze schaal → Watchlist; pragmatische v1 = missed-call → bericht-callback |
| D4 | **Text-to-SQL voor ad-hocvragen** | Werkt in 2026 alleen met gecureerde semantische laag (Metabase/Lightdash-les); fase 2, en dan alleen op whitelisted views |
| D5 | **Social scheduling (Postiz) + nieuwsbrief (Listmonk)** | Beide bewezen OSS; waarde vooral Fumero; OAuth-app-registraties zijn de echte frictie. Ná de eerste 3 Playbooks |
| D6 | **Open WebUI als interne staff-chat** | 145k stars, klaar product over LiteLLM/Ollama — maar overlapt met eigen Motor-chat; alleen overwegen als interne power-user-console |

### Hype-lijst (Rejected — niet aan beginnen)

DGX Spark als inference-server · exo/Mac-clustering · k3s op 2 nodes · voice-interfaces voor business-ops · autonome SEO-agents · "AI employee"-full-autonomy-aanbiedingen · LLM-gestuurde auto-remediation van infra · factuurautomatisering zonder approval-stap · onofficiële WhatsApp-API's als productie-infra.

## 36.3 Regelgeving (tijdgevoelig, geverifieerd juli 2026)

- **EU AI Act Art. 50 — 2 augustus 2026:** disclosure bij eerste klantinteractie is releasegate 7 in §25; helpers krijgen Art. 4-geletterdheid; bots gebruiken nooit een mensennaam.
- **NL e-invoicing/Peppol:** géén B2B-mandaat vandaag; ministerie-advies (10 mrt 2026): binnenlands B2B verplicht ~1 jan 2030, ViDA juli 2030. **Geen eigen Peppol-access-point bouwen**; Peppol-ontvangst via Moneybird geeft gratis gestructureerde UBL (geen OCR nodig) — extra argument voor K1.
- **GDPR/soevereiniteit:** dataklassen uit §22 bepalen route-tier en tracing. Persoonsgegevens worden gemaskeerd; `pii-strict` traceert geen content. Art. 9-werk wacht op DPIA en grondslag.

## 36.4 Commerciële validatie en EUR-prioriteitsblad

Marktprijzen zijn alleen referentie. Golf 4 begint met **één betalende pilotklant uit het eigen netwerk, hands-on en zonder SLA**; klantproductie draait niet vanaf de thuissite.

| Kans | Waarde/mnd | Bouwuren | Payback | Besluit |
|---|---:|---:|---:|---|
| K2 reviews | Door eigenaar vast te leggen vóór start | Door eigenaar vast te leggen | Bouwkosten ÷ waarde/mnd | AM-2 #1; geen uitbreiding zonder ingevulde cijfers |
| K1 bonnetjes | Door eigenaar vast te leggen vóór start | Door eigenaar vast te leggen | Bouwkosten ÷ waarde/mnd | AM-2 #2; v1 blijft handmatig |
| K3 monitoring | Onbekend | Onbekend | Niet bewezen | Watchlist |
| K4 forecast | Onbekend | Onbekend | Niet bewezen | Watchlist |
| K5 infra-digest | Onbekend | Onbekend | Niet bewezen | Watchlist |

**Beslisregel AM-5:** zonder aantoonbare payback <6 maanden blijft een kans Watchlist. De eigenaar vult K2/K1 in vóór uitvoering; marktschattingen vervangen geen eigen cijfers.

## 36.5 Inpassing in de bestaande golven

- **Week 1–2:** K2 reviews als Playbook #1 op bestaande n8n; Golf 0 blijft eerste technische prioriteit.
- **Week 2–4:** K1 bonnetjes als Playbook #2, cloud-vision en elke boeking handmatig.
- **Week 6–9:** K1/K2 naar Kernel/Gateway; migratie is de architectuurtest.
- **Week 9–12:** K3/K4/K5 alleen als aantoonbaar benodigde adapters voor dagbrief #3.
- **Na AM-1-gate:** pas dan reranker, MinerU, ComfyUI en overige bevroren kansen beoordelen.

**Bronkwaliteit-caveat:** enkele 2026-vergelijkingssites bleken SEO-/AI-contentfarms; claims zijn alleen meegewogen waar primaire bronnen (GitHub, officiële docs, peer-reviewed papers, selfh.st-survey) ze bevestigen.
