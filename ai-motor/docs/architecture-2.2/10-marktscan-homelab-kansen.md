# 36. Marktscan — homelab/self-hosted AI-markt 2026 en aansluitende kansen voor Motor AI

> Aanvulling op [Motor AI 2.2](README.md), onderzoek uitgevoerd 2026-07-21 (twee parallelle marktonderzoeken: homelab-/self-hosted-community + SMB-AI-ops-markt). Bewijsniveaus E1–E7 zoals in de rest van de synthese. Alle kansen zijn gefilterd door de adoptieladder en de 16 GB-/teamgrootte-constraints.

---

## 36.1 Hoofdconclusie

**De Motor AI-stack is de marktstandaard, geen buitenbeentje.** n8n + Ollama + Qdrant + Postgres + cloud-routing op Docker Compose is vrijwel identiek aan het officiële n8n Self-hosted AI Starter Kit-patroon waar de community in 2025–2026 op convergeerde (E4). De achterstand zit niet in de stack maar in: (a) use-cases erbovenop, (b) ops-discipline (updates, secrets, monitoring, backups), (c) één acute deadline (EU AI Act Art. 50, 2 aug 2026).

## 36.2 Nieuwe kansen — geprioriteerd

Statussen sluiten aan op de [technology-lifecycle-matrix (§28)](07-lifecycle-en-traceability.md).

### Tier 1 — Adopt/Configure (bewezen patroon, hoge waarde, past in RAM-budget)

| # | Kans | Tools | Bewijs | RAM | Waarde |
|---|---|---|---|---|---|
| K1 | **Bonnetjes/factuur → Moneybird-pipeline** (foto via Telegram → vision-extractie → validatie btw/rekensom → concept-boeking → approval) | Paperless-ngx + paperless-gpt/PaperCortex-klasse AI-laag + LiteLLM-vision + Moneybird API | E1/E4 — bewezen NL/DE-categorie; vision-extractie 87–97% veldnauwkeurigheid (peer-reviewed, arXiv 2509.04469) | ~2 GB | Hoog, maandelijks terugkerend; wordt Playbook #2 of #3 |
| K2 | **Review-response-automation Bokas** (4–5★ auto, 1–3★ via approval) | Google Business Profile API + engine-workflow + bestaande Telegram-approvals | E1 — meest gerepliceerde SMB-AI-workflow (meerdere onderhouden n8n-templates) | ~0 | Hoog voor reputatie; 1-op-1 op bestaand approval-ontwerp |
| K3 | **Concurrent-/prijs-/webmonitoring → dagbrief** | changedetection.io (~25k stars) + LLM-diff-samenvatting | E1/E4 | ~0,5 GB | Middel-hoog, beide tenants; voedt de Bokas-brief (§32) |
| K4 | **Anomaliedetectie + forecast op omzet in de dagbrief** | statsforecast (prediction intervals; v2.1 jul 2026) + vaste SQL + LLM-narratie | E1 — statistiek detecteert, LLM vertelt (anti-hype-ontwerp, conform §19-beslisboom: deterministisch waar het kan) | ~0 | Hoog voor Bokas-ops |
| K5 | **Infra-log-triage → digest** ("infrastructuur-alinea" in de ochtendbrief) | logs → filter → LLM actionable/ruis → Telegram (kritiek) / digest (rest) | E5 — community-gevalideerd patroon (Cortex-homelab e.a.); LLM = triage, nooit auto-remediation | ~0 | Middel; solo-operator-verzekering |

### Tier 2 — Ops-verbeteringen (direct, klein, sluit aan op §26–27)

| # | Verbetering | Detail | Bewijs |
|---|---|---|---|
| O1 | **Container-updates: Watchtower vervangen** | containrrr/watchtower gearchiveerd 2025-12-17 → Renovate-PR's tegen compose-files in git (past bij GitOps/doc-CI) of Diun (notify-only). Nooit blind auto-updaten op businesskritieke stacks | E1 |
| O2 | **Secrets: sops + age** | Encrypted values in git, geen extra server; bevestigt §16-keuze. Infisical pas bij meerdere operators | E5 (consensus) |
| O3 | **Monitoring: Beszel + Uptime Kuma** | Samen ~150–180 MB; alerts naar Telegram; Prometheus/Grafana is overkill <10 hosts | E4/E5 |
| O4 | **Backup: restic/Borg 3-2-1 + push-monitor** | Stille backup-failure = alert (healthchecks-patroon); versterkt de restore-test-discipline uit §27 | E1 |
| O5 | **Embeddings-upgrade** | nomic-embed-text → bge-m3 of Qwen3-Embedding-0.6B (multilingual/NL) + Qwen3-Reranker-0.6B vóór Qdrant-resultaten; CPU-haalbaar. Let op bestaande regel: wissel = volledige re-index | E4 |
| O6 | **NUC → 32 GB RAM (~€70)** | Goedkoopste capability-unlock: MoE-modellen (Gemma 4 26B-A4B-klasse, ~4B actief) draaien dan lokaal ~5+ tok/s voor batch-extractie/tagging — kosten-/privacy-winst voor R0/R1-taken | E4/E5 |
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

- **EU AI Act Art. 50 — 2 augustus 2026, mét handhaving:** klantgerichte chatbots/voice-agents moeten AI-disclosure tonen bij eerste interactie, in de interface. Geen SMB-uitzondering. Interne tools (dagbrief, triage, extractie voor eigen personeel) vallen er praktisch buiten. Actie: disclosure-banner is een releasevoorwaarde voor élke klantgerichte bot (opnemen in Action Gateway-releasegates §25); gepubliceerde AI-content houdt een human-review-stap; bots nooit onder een mensennaam.
- **NL e-invoicing/Peppol:** géén B2B-mandaat vandaag; ministerie-advies (10 mrt 2026): binnenlands B2B verplicht ~1 jan 2030, ViDA juli 2030. **Geen eigen Peppol-access-point bouwen**; Peppol-ontvangst via Moneybird geeft gratis gestructureerde UBL (geen OCR nodig) — extra argument voor K1.
- **GDPR/soevereiniteit:** EU-SMB's kiezen self-hosted om de transferproblematiek (Schrems II, CLOUD Act) te vermijden; het gelaagde model (PII → EU-endpoints zoals Mistral; geminimaliseerde context naar US-modellen; ruwe data in eigen PG/Qdrant) is precies de bestaande LiteLLM-named-routes-structuur (§24) — routeringsregel per dataklasse toevoegen.

## 36.4 Commerciële validatie (productfabriek, Golf 4)

Marktdata 2026 (operator-surveys, agency-pricing): losse workflow-builds $1.800–4.500; SMB-retainers $650–1.200/mnd; AI-agent-retainers $2.500–6.000/mnd (snelst groeiend). **Self-hosted verkoopt 40–60% duurder** in de EU omdat de klant stack + compliance bezit. Wat verkoopt is exact wat Motor AI intern bouwt: review-automation, bonnetjes-intake, rapportage-digests, monitoring-retainers. Wat churnt: generieke "AI employee"-chatbots zonder workflow. → Bevestigt Golf 4 (§31): elk intern Playbook is potentieel een €500–1.500/mnd productized service met "data blijft op EU-infra" als differentiator; Bokas/Fumero als live case studies.

## 36.5 Inpassing in de bestaande golven

- **Golf 1 (nu):** O1–O4 (updates, secrets, monitoring, backup-alerting) — ops-hygiëne, geen architectuurwijziging.
- **Golf 2 (pilot):** K3 + K4 + K5 worden input-adapters/secties van de Bokas-dagbrief — ze verrijken de pilot zonder scope-explosie.
- **Golf 3:** K1 (bonnetjes→Moneybird) als Playbook #2 (heeft Gateway + approvals nodig, dus ná Golf 1); K2 (reviews) als Playbook #3; O5/O8/O9 waar capaciteit is.
- **Golf 4:** D5, D2 (mét Art. 50-disclosure), productizing van bewezen Playbooks.
- **Direct, los van golven:** Art. 50-check borgen in releasegates (§25); O6 (RAM) bij eerstvolgende hardware-moment.

**Bronkwaliteit-caveat:** enkele 2026-vergelijkingssites bleken SEO-/AI-contentfarms; claims zijn alleen meegewogen waar primaire bronnen (GitHub, officiële docs, peer-reviewed papers, selfh.st-survey) ze bevestigen.
