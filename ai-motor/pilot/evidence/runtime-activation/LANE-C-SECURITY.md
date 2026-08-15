# LANE-C-SECURITY — P0.6 spoor C: onafhankelijke security- en failure-review

> **Spoor:** C (security & failure) · **Agent:** C · **Datum:** 2026-08-15
> **Branch:** `pilot/runtime-c-security` · **Baseline:** `50dd65dbe1dd70bd5d58d86221b1e587b4d201d9`
> **Eind-SHA:** zie kop "Rapportage" onderaan (wordt bij elke groene stap bijgewerkt).
>
> Scope: uitsluitend `ai-motor/pilot/security/**` en dit bestand. Geen
> productiecode gewijzigd. Twee echte gaten zijn als **falende test**
> vastgelegd en onder ESCALATIE gerapporteerd — niet zelf gefixt.
> De testsuite eindigt daarom bewust met TESTS_EXIT=1.

## Legenda

- **HOUDT** — de aanval eindigt aantoonbaar in DENY / failed / veilige
  terminale staat; de test is groen.
- **ESCALATIE** — de aanval slaagt (deels); vastgelegd als falende test;
  zie de ESCALATIE-sectie.

## Aanvalspunten 1–10

### 1. Adapter buiten de allowlist — STATUS: HOUDT

- **AANVAL:** `PILOT_ADAPTER=evil` en negentien varianten (case, whitespace,
  newline, null-byte, pad, URL, classnaam, prototype-namen, leeg).
- **VERWACHTE DENY:** `adapterFromEnv` gooit altijd; de typeguard is nooit
  true; `createPilotAdapter` met een niet-geallowlist id bouwt nooit een
  adapter-object; de foutmelding noemt alleen de allowlist.
- **BEWIJS:** `S1a`, `S1b`, `S1c` in `pilot/security/registry.test.ts`.

### 2. Vrije URL/classname uit userinput — STATUS: HOUDT

- **AANVAL:** endpoint-velden via server-side env met exotische schema's
  (`gopher://`), credentials in de URL, of https; adapter/model_url/baseUrl/
  sidecar_url/endpoint-velden in de HTTP-request-body van `/draft`.
- **VERWACHTE DENY:** constructie faalt gesloten (`must be http`,
  `plain http without credentials`, `ontbreekt`); body-velden worden nooit
  aan adapterbinding of endpoints doorgegeven — de server-gebonden
  adapter draait, er ontstaat geen netwerk-uitweg naar meegegeven URL's.
- **BEWIJS:** `S2a`, `S2b`, `S2c` in `pilot/security/registry.test.ts`.

### 3. Sidecar-compose-overlays: mounts en secrets — STATUS: HOUDT

- **AANVAL:** overlay-configuratie die context/draft/host-volumes, docker-
  of tailscale-sockets, secrets in env, host-netwerk of extra privileges
  zou toekennen aan een sidecar.
- **VERWACHTE DENY:** statische compose-guards (commentaar gestript,
  blokken op regelbegin geankerd — les uit spoor A) bewijzen: geen
  verboden volumes, geen secret-achtige env-keys, geen host-network,
  `no-new-privileges`, read-only root; hermes geheel zonder gepubliceerde
  poort (internal netwerk), agentscope alleen `127.0.0.1:4410` loopback;
  basiscompose publiceert niets en alleen de store krijgt
  `tailscaled.sock` (read-only).
- **BEWIJS:** `S3a`, `S3b`, `S3c` in `pilot/security/compose-guards.test.ts`.

### 4. Tool/MCP/memory-activatie in sidecar-source — STATUS: HOUDT

- **AANVAL:** verborgen toolregistratie, MCP-client, memory-activering,
  dynamische code (`eval`/`exec`/`__import__`) of outbound HTTP in de
  Python-sidecars.
- **VERWACHTE DENY:** static guards op narrative-gestripte bron:
  agentscope — geen `agentscope.init`, Toolkit wordt aangemaakt, leeg
  geassert en nooit doorgegeven; hermes — puur stdlib, geen
  toolregistratie, `invoke` faalt eerlijk met 501. Beiden spreken
  uitsluitend het fase-0-protocol (`/health`, `/invoke`, `/cancel`).
- **BEWIJS:** `S4` (4 tests) in `pilot/security/sidecar-source-guards.test.ts`.

### 5. Malformed protocolberichten naar /mcp en adapters — STATUS: HOUDT

- **AANVAL:** kapotte JSON, niet-JSON-RPC-vormen, verkeerde
  content-type, oversized bodies, kapotte sidecar-responses (malformed
  JSON, ontbrekende velden, verkeerde types, foute causale echo's).
- **VERWACHTE DENY:** handler → `invalid_request`/`parse_error` zonder de
  read-driver te bereiken; HTTP → 415/400/DENY; adapters →
  `malformed_response`/`causal_mismatch`. Nooit een crash, nooit een
  hang — na elke reeks beantwoordt de server nog steeds.
- **BEWIJS:** `S5a`–`S5d` in `pilot/security/mcp-attacks.test.ts`;
  adapter-niveau reeds in `pilot/conformance.test.ts` en
  `lib/adr110/adapters/hermes/adapter.test.ts` (blijven groen).

### 6. Timeout/cancel zonder evidence — STATUS: HOUDT

- **AANVAL:** adapter die timeout/unavailable/malformed_response geeft,
  midden in de volledige `runDraft`-flow; cancel ná een gefaalde attempt.
- **VERWACHTE DENY:** elke failure eindigt in terminale Motor-state
  (`failed`) mét valide causale failure-evidence (outcome status failure,
  artifact met de fase-0-foutcode, keten valide, nul orphans) en er wordt
  nooit iets opgeslagen; cancel blijft terminaal antwoorden (< 1 s, geen
  throw).
- **BEWIJS:** `S6a`, `S6b` in `pilot/security/run-flow-attacks.test.ts`;
  conformiteit op adapter-niveau in `pilot/conformance.test.ts`
  (`adapterfout → terminale Motor-state + causale failure-evidence`, groen).

### 7. Hergebruik/vervalsing van runtime-evidence — STATUS: HOUDT

- **AANVAL:** per veld de inhoud muteren mét behoud van de oude digest;
  een elders geldige digest op een ander record plakken; een record onder
  een onbekende parent hangen mét eerlijk herberekende digest; de
  parent-relatie wegsnijden; een integer record uit een andere run
  invoegen; een bestaand `evidence_id` recyclen; een tussen-schakel
  verwijderen.
- **VERWACHTE DENY:** `buildEvidenceChain` meldt `digest mismatch
  (tampered)` / `duplicate evidence id` en is nooit `ok`; `findOrphans`
  vlagt herlinkte, root-loze en gereplayde records als orphan; een keten
  met een gat faalt altijd als geheel.
- **BEWIJS:** `S7a`–`S7e` in `pilot/security/evidence.test.ts`.
  (Settlement-v2-tamper per veld en replay: reeds bewezen in
  `pilot/boundary.test.ts` 4b/6a/6c; `S10b` herbevestigt replay functioneel.)

### 8. Publish/mail/payment/device-control ná een geslaagde run — STATUS: HOUDT

- **AANVAL:** na een échte geslaagde synthetische run (écht opgeslagen
  concept, échte causale id's) en een échte `approved`-beslissing alsnog
  publish/mail/payment/device-control proberen; het beslissings-receipt
  als publish-receipt presenteren; een écht gemint store-receipt
  cross-capability recyclen, dubbel gebruiken, of met gewijzigde
  argumenten.
- **VERWACHTE DENY:** evaluate is nooit ALLOW, mint faalt, execute met
  `null` faalt; vreemde receipts → `receipt_not_minted_by_this_gateway`;
  cross-capability → `tool_mismatch`; dubbel gebruik →
  `receipt_already_used`; gewijzigde argumenten →
  `argument_hash_mismatch`. De ingebouwde publish-probe van de flow
  bevestigt `receipt_required`.
- **BEWIJS:** `S8a`, `S8b`, `S8c` in `pilot/security/run-flow-attacks.test.ts`
  (bouwt voort op boundary-test 7f, nu met echte run ervoor).

### 9. MCP: unknown_tool / extraArguments / verkeerde types / cross-workspace / notification — STATUS: **ESCALATIE** (E1, E2)

- **AANVAL:** `tools/call` met onbekende tool, met extra argumenten, met
  verkeerde types, met een `run_id` van een andere workspace; een
  notification zonder `id`.
- **VERWACHTE DENY:** onbekende tool/extra's/verkeerde types → DENY
  zonder read (HOUDT: `S9a`–`S9c`, groen). Cross-workspace `run_id` →
  nooit een snapshot (**FAALT**: E2). Notification → géén response en
  geen read (**FAALT**: E1).
- **BEWIJS:** `S9a`–`S9f` in `pilot/security/mcp-attacks.test.ts`;
  `S9d` (E1), `S9e` en `S9f` (E2) falen bewust.

### 10. Cross-container store-grens — STATUS: HOUDT

- **AANVAL:** vanaf "vertrouwd" loopback zelf: geen settlement, incomplete
  settlement, v1-protocol, verlopen bewijs, verkeerde sleutel,
  payload-swap, replay van een volledig geldig settlement; daarnaast
  malformed/oversized bodies en verkeerde methoden.
- **VERWACHTE DENY:** altijd 4xx (`settlement_required`,
  `unsupported_version`, `settlement_expired`, `bad_signature`,
  `record_mismatch`, `settlement_replayed`), nooit een write; zonder
  geldig runtime-secret is de store fail-closed (503); de server crasht
  of hangt nooit. De localhost-aanname is expliciet gemaakt: statische
  guard op `listen(PORT, "127.0.0.1")` én een functionele probe die
  bewijst dat de store via geen enkel niet-loopback IPv4-adres van de
  host bereikbaar is.
- **BEWIJS:** `S10a`–`S10e` in `pilot/security/store-service-attacks.test.ts`.

## ESCALATIE

Twee echte gaten, beide vastgelegd als falende test. Niet zelf gefixt
(productiecode is buiten scope voor spoor C).

### E1 — MCP beantwoordt `tools/call`-notifications (én voert de read uit)

- **Test:** `S9d` in `pilot/security/mcp-attacks.test.ts` (faalt).
- **Waargenomen:** een JSON-RPC-bericht `{ "jsonrpc": "2.0", "method":
  "tools/call", "params": … }` **zonder `id`** — per JSON-RPC 2.0 een
  notification die nooit beantwoord mag worden — krijgt van
  `createMcpPilotHandler` toch een volledig resultaat
  (`{ id: null, result: { … motor_decision: "ALLOW", snapshot … } }`)
  én de read-driver wordt daarvoor aangeroepen.
- **Verwacht:** response `null` en de read-driver nooit bereikt.
- **Impact:** protocolbreuk; een client die bewust notifications stuurt
  (fire-and-forget) veroorzaakt alsnog reads en krijgt data terug.
  Beperkt tot het read-only MCP-pad; geen schrijfoppervlak.
- **Richting (voor owner):** in `pilot/mcp/server.ts` vóór dispatch:
  ontbrekende `id` → `null` retourneren voor álle methodes (nu geldt dat
  kennelijk alleen voor bekende notification-namen).

### E2 — Cross-workspace `run_id` lekt via de gedeelde conceptstore

- **Tests:** `S9e` (provider/handler-niveau) en `S9f` (echte HTTP naar
  `/mcp` vanaf een node met een andere ACL-workspace) — beide falen.
- **Waargenomen:** `createStoreSnapshotProvider` controleert alleen dat
  de **geclaimde** workspace gelijk is aan de boundary
  (`scope.workspace_id !== deps.workspaceId → null`), maar matcht daarna
  `run_id` tegen de **volledige gedeelde drafts-lijst** —
  `drafts.jsonl` heeft geen workspace-kolom. Een client van workspace B
  die een `run_id` van workspace A kent of raadt, krijgt A's gesanitiseerde
  snapshot. Over echte HTTP bevestigd: node B (ACL: alleen `ws-anders`)
  krijgt een 200 met snapshot van `run-van-ws-motor`.
- **Grensbewaking wél bewezen:** de sanitizer redacteert altijd
  `draft_text`/`review` — de marker-asserts in `S9f` bewijzen dat geen
  ruwe inhoud lekt; het lek betreft metadata (status, digests,
  tijdstempel) plus een bestaans-orakel op `run_id`.
- **Verwacht:** `found: false` / DENY voor elke `run_id` die niet bij de
  afgesproken workspace hoort.
- **Richting (voor owner):** workspace-veld opnemen in het store-record
  (het v2-settlement dekt `workspace_id` al, dus de store kan het veld
  getekend meeschrijven) en in de provider erop filteren; tot dan geldt
  de pilot-aanname "run_id's zijn globaal uniek en onraadbaar" als enige
  grens — dat is obscurity, geen isolatie.

## Observaties (geen escalatie, ter kennisgeving)

1. `createPilotAdapter` (`pilot/registry.ts`) heeft geen `default`-throw in
   de switch: een JS-caller zonder typechecking krijgt `undefined` terug
   voor een vreemde naam. Veilig (nooit een invokeerbaar object — bewezen
   in `S1c`), maar een expliciete throw zou luider falen.
2. `PILOT_ADAPTER_IDS` is een `as const`-array maar runtime niet
   `Object.freeze`n. Ongevaarlijk zolang lookups via
   `PILOT_ADAPTER_IDS.includes` lopen (exacte match); vermelding als
   hardening-kandidaat.
3. `buildEvidenceChain`/`findOrphans` kunnen **same-run** hergebruik van
   een attempt-id met herberekende digest principieel niet onderscheiden
   van een legitieme extra actie in die run. Detectie van dat hergebruik
   zit in de engine (order-conflict op een voltooide task) en in de
   store/settlement-uniekheid — gelaagd dus afgedekt, maar de
   ketenvalidator alleen is onvoldoende. Bewust zo gedocumenteerd in
   `S7d`/`S7e`.
4. De HTTP-routes matchen `req.url` exact: `/mcp?workspace=x` valt op de
   404. Fail-closed (geen data), maar wie een queryparam meestuurt krijgt
   "not found" in plaats van de workspace-selectie die de code erachter
   suggerereert. `S9f` is daarom zonder querystring opgezet.
5. `S10e` (niet-loopback-bereikbaarheid) slaat conditioneel over als de
   host geen niet-loopback IPv4-adres heeft; op de builder was er een
   extern adres en was de store daar niet bereikbaar.

## Restrisico's

- E2 staat open tot een ownerbesluit over tenancy in de store; zolang de
  pilot één gedeelde `drafts.jsonl` gebruikt, is elke extra workspace op
  dezelfde store een lekkende grens.
- E1 staat open tot de notification-dispatch wordt dichtgezet.
- De compose-guards en source-guards zijn statisch bewijs over de
  huidige bestanden; een toekomstige overlay-wijziging wordt alleen
  opgemerkt zolang deze tests in CI/builder meedraaien.
- De agentscope-overlay draait op een bridge-netwerk met gedocumenteerde
  egress-caveat (zie `compose.agentscope.yaml`); de guard bewijst dat de
  enige poort host-loopback is, niet dat egress onmogelijk is.

## Rapportage

- **Eind-SHA:** `4c7bd8b` (plus dit document: zie laatste commit op
  `pilot/runtime-c-security`)
- **Builder-exitcodes:** TESTS_EXIT=1 (**verwacht** — drie escalatietests
  falen bewust), TYPES_EXIT=0, LINT_EXIT=0
- **Testaantallen:** 202 pass / 3 fail (205 totaal), waarvan 37 tests uit
  `pilot/security/` (34 groen, 3 bewust falend: `S9d`, `S9e`, `S9f`).
- **Escalaties:** E1 (MCP-notification), E2 (cross-workspace run_id).
- **Bestanden:** `pilot/security/registry.test.ts` (6),
  `compose-guards.test.ts` (3), `sidecar-source-guards.test.ts` (4),
  `mcp-attacks.test.ts` (10), `evidence.test.ts` (5),
  `run-flow-attacks.test.ts` (5), `store-service-attacks.test.ts` (5).
- Alles synthetisch; geen echte secrets, IP's, hostnames of bedrijfsdata
  gebruikt of vastgelegd.
