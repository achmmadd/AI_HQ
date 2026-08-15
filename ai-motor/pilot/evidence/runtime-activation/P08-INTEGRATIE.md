# P0.8 — compose-integratie (code-only) en verplichte store-tenancy

> Spoor: P0.8-prep op branch `pilot/p08-integratie`, basis
> `pilot/runtime-activation` @ `38fe296` (P0.6 FINAL, 218/0 groen).
> Dit document is het ontwerp- en bewijsartefact van de CODE-stap. Het
> autoriseert géén live actie: de daadwerkelijke activatie (sidecars starten,
> API op een sidecar-adapter zetten) is een aparte stap met eigen,
> command-specifieke eigenaarsgoedkeuring.

## Scope en grenzen

Wel: verplichte tenancy in de store, compose-ontwerp voor sidecar-egress,
API-env voor adapterselectie, uitgebreide guards/tests, dit document.
Niet: deploy/restart van de draaiende stack, echte bedrijfscontext, publieke
ingress, master-merge, governance-docs, adapter-/sidecar-sources, `mcp/*`,
UI-structuur. Grenzen uit P0.6 FINAL blijven onverkort gelden.

## Tenancy-model (restrisico #3 uit P0.6 FINAL opgelost)

- `DraftStoreRecord` en `DecisionStoreRecord` dragen verplicht
  `workspace_id: string` (compile-time, `pilot/draft-store.ts`).
- De store-service (`pilot/store-service.ts`) weigert ieder record zonder
  niet-lege string-`workspace_id` met **400 `workspace_id_required`** —
  fail-closed, óók op de legacy-route (`type` ontbrekend = "draft").
- Na settlement-verificatie moet de tenancy van het record exact gelijk zijn
  aan de geauthenticeerde `workspace_id` in het settlement; afwijking is
  **403 `workspace_mismatch`** (bewijsschending, geen vormfout).
- De atomische first-decision-wins-claim is per workspace gescoped
  (`decision-<workspace>-<draft_run_id>`): een gedeelde `draft_run_id` over
  twee tenants geeft nooit een vals `already_decided`.
- `listDrafts`/`listDecisions(limit, path, workspaceId?)` filteren
  fail-closed: met een workspaceId zijn alleen exacte matches zichtbaar en
  valt de filter vóór de limit ("recentste N van déze workspace"). Zonder
  workspaceId blijft de read ongefilterd — dat pad is uitsluitend voor
  interne/test-aanroepen; de API en de decision-flow geven altijd de
  server-side (ACL) vastgestelde workspace mee.
- De MCP store-provider (`pilot/mcp/store-provider.ts`) is bewust ongemoeid:
  hij mag de store-filter aannemen maar filtert zelf óók nog op workspace
  (defense-in-depth). Beide lagen zijn onafhankelijk voldoende.
- `runDraft`/`runDecision` nemen optioneel `workspaceId`; de API
  (`pilot/server.ts`) geeft uitsluitend de ACL-uitkomst door. De CLI en
  oudere testpaden vallen terug op de pilot-default `ws-motor` — de store
  weigert hoe dan ook ieder record zonder workspace.

## Beslissing: bestaande records op Hetzner (demo-data)

Bestaande `drafts.jsonl`-regels op Hetzner zijn synthetische demo-data uit
de pre-tenancy-periode. Gekozen is de veiligste variant: **geen
automatische migratie; legacy-regels zijn onzichtbaar tenzij expliciet
geannoteerd**. Concreet:

- Oude regels blijven fysiek ongemoeid in het append-only bestand, maar
  zonder `workspace_id` zijn ze voor elke workspace onzichtbaar — in
  `listDrafts`/`listDecisions` (API/UI) én via de MCP store-provider.
- Wil de eigenaar een specifieke oude regel tóch behouden, dan is dat een
  handmatige, per-regel annotatie (`"workspace_id":"ws-motor"` toevoegen aan
  die JSONL-regel op het volume) — een data-mutatie die een aparte,
  expliciete eigenaarsgoedkeuring vereist en buiten deze code-stap valt.
- Nieuwe writes dragen altijd tenancy; de store weigert al het andere.

## Egress-ontwerp (compose-integratie, code-only)

Elke sidecar-overlay krijgt precies één tweede netwerk-attachment:
`pilot-egress`, een gewone bridge **zonder** `internal`-flag, uitsluitend
gekoppeld aan de sidecar en aan niets anders — dat is de minimale opening
naar het tailnet-ModelPort, want het bestaande eiland (`hermes-net`, resp.
het agentscope-`sidecar`-netwerk) blijft resp. wordt `internal: true` en
draagt daardoor geen enkele egress, terwijl de Motor-facing kant onveranderd
blijft (hermes publiceert geen poort — de API op `network_mode: host`
bereikt het container-IP op `hermes-net`, de host routeert immers altijd
naar eigen bridges, óók interne; agentscope behoudt zijn bestaande
`127.0.0.1:4410`-publish, die via de docker-proxy onafhankelijk is van de
internal-vlag). Er komen geen poorten, geen volumes en geen host-network bij
voor sidecars; alleen modelverkeer richting het tailnet verlaat de container
via `pilot-egress`. De twee overlays definiëren `pilot-egress` identiek
(`driver: bridge`), maar door hun verschillende compose-projectnamen
(`motor-pilot` resp. `motor-pilot-agentscope`) ontstaan twee gescheiden
bridges — extra isolatie, geen gedeeld oppervlak. Begrensing van egress tot
uitsluitend het ModelPort-IP blijft een bewuste operatorhandeling op de
host-firewall (ufw/iptables), buiten compose.

De basiscompose (`compose.yaml`) krijgt op de API uitsluitend drie
env-toevoegingen met gedragsneutrale defaults — `PILOT_ADAPTER` (default
`llamacpp` = het huidige directe-ModelPort-gedrag), `HERMES_SIDECAR_URL` en
`AGENTSCOPE_SIDECAR_URL` (default leeg; de allowlisted registry faalt
gesloten als een gekozen sidecar-adapter zijn URL mist). Fictieve
placeholders staan in `infra/pilot/.env.example`. De basisdiensten
(api/store/cli) krijgen zelf nooit een `pilot-egress`-attachment (guard S3d).

## Activatiecommando's (voor de latere live-stap — géén autorisatie nu)

Uit te voeren op Hetzner in `infra/pilot/`, pas ná een bijgewerkte
repo-checkout én een aparte goedkeuring. Elke `up` is bewust
service-gescoped met `--no-deps`: compose convergeert alleen de genoemde
service en recreëert `motor-pilot-api`/`motor-pilot-store` nooit als
bijvangst.

```bash
# 0. Vooraf: .env aanvullen met de P0.8-keys (fictieve vorm in .env.example).
#    De nieuwe API-env staat al in compose.yaml met gedragsneutrale defaults;
#    zolang .env PILOT_ADAPTER niet wijzigt, verandert er niets aan de
#    draaiende stack.

# 1. Bouw de sidecar-images (gepinde bases/hashes al bewezen in P0.6).
docker compose -f compose.yaml -f compose.hermes.yaml build hermes-sidecar
docker compose -f compose.yaml -f compose.agentscope.yaml build agentscope-sidecar

# 2. Start UITSLUITEND de sidecars (api/store blijven onaangeroerd).
docker compose -f compose.yaml -f compose.hermes.yaml up -d --no-deps hermes-sidecar
docker compose -f compose.yaml -f compose.agentscope.yaml up -d --no-deps agentscope-sidecar

# 3. Verifieer vóór elke verdere stap:
#    a. api/store niet gerecreëerd (CreatedAt ongewijzigd):
docker ps --filter name=motor-pilot-api --filter name=motor-pilot-store \
  --format '{{.Names}} {{.CreatedAt}} {{.Status}}'
#    b. netwerkvorm zoals ontworpen (eiland internal, egress apart):
docker network inspect motor-pilot_hermes-net --format '{{.Internal}}'        # true
docker network inspect motor-pilot-agentscope_sidecar --format '{{.Internal}}' # true
docker network inspect motor-pilot_pilot-egress --format '{{.Internal}}'      # false
#    c. hermes-container-IP op hermes-net bepalen (voor HERMES_SIDECAR_URL):
docker inspect motor-pilot-hermes-sidecar-1 \
  --format '{{index .NetworkSettings.Networks "motor-pilot_hermes-net" "IPAddress"}}'
#    d. synthetische readiness, nog zonder echte model-egress:
curl -fsS http://<HERMES_CONTAINER_IP>:4410/health   # vanaf de host (degraded zolang het model onbereikbaar is)
curl -fsS http://127.0.0.1:4410/health               # agentscope via loopback-publish

# 4. Pas hierna, met opnieuw een aparte goedkeuring: PILOT_ADAPTER en de
#    sidecar-URL invullen in .env en de API convergeren
#    (docker compose -f compose.yaml up -d --no-deps motor-pilot-api) —
#    dát is de eigenlijke live-flip en valt buiten P0.8-prep.
```

## Testbewijs (code-side, in de bestaande gate)

- `pilot/security/store-service-attacks.test.ts` — S11a: records zonder/
  met lege/niet-string `workspace_id` → 400 `workspace_id_required`, nooit
  een write (incl. legacy-vorm zonder `type`); S11b: record-tenancy ≠
  settlement-tenancy → 403 `workspace_mismatch`; S11c: decision-claims
  per workspace (gedeelde `draft_run_id` conflict niet over tenants;
  first-decision-wins binnen de workspace intact). Bestaande S10-fixtures
  dragen nu `workspace_id` (tenant-consistent met hun settlement).
- `pilot/boundary.test.ts` — 8a: read-filter is fail-closed en legacy-regels
  zijn nergens zichtbaar (filter vóór limit); 8b: de API geeft de
  ACL-workspace door aan `listDrafts`/`listDecisions`/`runDraft`/
  `runDecision`; 8c: end-to-end via de echte store-service — vreemde
  workspace ziet niets, handmatig bijgeplaatste legacy-regel blijft
  onzichtbaar.
- `pilot/security/compose-guards.test.ts` — S3a/S3b verscherpt: de oude
  exclusiviteitsassert (`exact ["hermes-net"]`) is vervangen door een
  gesloten-set-invariant (`{eiland, pilot-egress}`, eiland verplicht én
  `internal: true`, `pilot-egress` nooit internal, precies één attachment,
  nergens `internal: false`); S3d nieuw: basiscompose kent `pilot-egress`
  niet en de API-env-defaults zijn gedragsneutraal. Bestaande eisen
  (geen volumes/secrets/host-netwerk/poorten-matrix) onverzwakt.
- Collateral buiten de toegewezen paden, noodzakelijk voor een groene
  `tsc`-gate: in `pilot/security/mcp-attacks.test.ts` dragen de twee
  S9e/S9f-fixtures nu `workspace_id: "ws-motor"` met bijgewerkt commentaar
  (het pre-P0.8-premisse "records zonder workspace-kolom" is vervallen; het
  legacy-scenario wordt nu door boundary-8a/8c gedekt). Geen semantische
  wijziging van de aanvalsclaims; `pilot/mcp/*` zelf is ongemoeid.

## Restrisico's

1. Het hermes-container-IP op `hermes-net` is niet stabiel over recreates
   heen; `HERMES_SIDECAR_URL` moet dan opnieuw bepaald (stap 3c). Een
   loopback-publish zoals bij agentscope zou dat oplossen maar opent een
   host-poort — bewust niet gekozen ("geen poorten" voor hermes blijft).
2. `pilot-egress` is een algemene bridge: egress is niet fijnmazig beperkt
   tot het ModelPort-IP. Host-firewallregels (ufw/iptables op de bridge)
   blijven een operatorhandeling — overgenomen uit het LANE-C-restrisico,
   nu wél met een dicht eiland als uitgangspunt.
3. Bereikbaarheid van een internal-netwerk-container vanaf de host
   (hermes-pad) is een docker-gedragsaanname; stap 3d verifieert die vóór
   elke adapter-flip. Zou die falen, dan is de fallback een apart
   goed te keuren loopback-publish — niet stilletjes toevoegen.
4. Legacy-demo-records op Hetzner verdwijnen uit alle reads (bedoeld); wie
   ze toch nodig heeft volgt de handmatige annotatieroute met eigen
   goedkeuring.
5. Agentscope-`sidecar`-netwerk wordt `internal: true` (harding t.o.v.
   P0.6): de loopback-publish werkt via de docker-proxy ongewijzigd, maar
   de activatie-smoke (3d) moet dat empirisch bevestigen.
6. Guard-tests zijn statisch bewijs; ze gelden zolang de suite in de gate
   meedraait (ongewijzigd t.o.v. P0.6-restrisico 4).

## Validatie (Hetzner-builder)

Eerste gate-run op `47b0aed` (code + tests, dit document nog zonder
uitkomsten): `TESTS_EXIT=0` (225 pass / 0 fail / 1 geregistreerde skip —
ongewijzigd de conformance-modus zonder python in alpine), `TYPES_EXIT=0`,
`LINT_EXIT=0`. Testdelta t.o.v. P0.6 (218): +7 = S11a/S11b/S11c (tenancy,
store), 8a/8b/8c (tenancy, reads/API/e2e) en S3d (basiscompose-guard).

Eindstatus (dit document ingevuld; alleen doc-delta sinds `47b0aed`):

```text
SHA=b282cd7d2818790a705cc69b2c8771525d0e07a4
TESTS_EXIT=0   TYPES_EXIT=0   LINT_EXIT=0
pass/fail/skipped: 225/0/1
```

De SHA staat hierboven één commit na de run op de inhoud van deze commit zelf
(anders onmogelijk: de hash dekt dit bestand). De getoonde exitcodes gelden de
exacte inhoud van `b282cd7`; de run op `47b0aed` dekt alle code en tests.

REAL_CONTEXT_USED=no · EXTERNAL_EFFECTS=no · PUBLIC_INGRESS=no ·
MASTER_MERGE=no · LIVE_ACTIVATION=no (aparte stap, aparte goedkeuring)
