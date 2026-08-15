# LANE-D-CONFORMANCE — vijf-adapter conformance met echte sidecars + regressie (evidence)

Sprint: P0.6 (runtime-activatie) · Lane: D · Branch: `pilot/runtime-d-conformance`
Datum: 2026-08-15 · Uitvoerder: Cursor-agent (Agent D)
Protocol/taxonomie: [`../integration-sprint/PHASE-0.md`](../integration-sprint/PHASE-0.md), exact gevolgd.

## Checkpoint

```text
BASE_SHA=725832b4a2db656393080f0d12c540c9f038cdb8  (origin/pilot/runtime-activation bij lane-start;
                                                    bevat de GEREALISEERDE hermes- en agentscope-sidecars)
CODE_SHA=22015f6b9aa13a29b2400cdde8be43f041a7d748  (conformance.test.ts-uitbreiding; beide validatiepasses hierop groen)
EIND_SHA=f1e7de1a53851561196f63b8dcdbf8d0ded20757  (finale validatie hierop groen; deze invulling is de vervolgcommit)
WERKBOOM=/tmp/aihq-p06-d (git worktree op pilot/runtime-d-conformance)
BUILDER=Hetzner (x86_64, Docker 29.3.1); eigen validatiedir /tmp/pv-d (ras-immuun, geen gedeelde checkout)
```

Eigen paden (enige schrijver deze lane):

- `ai-motor/pilot/conformance.test.ts` — uitgebreid (zie hieronder)
- `ai-motor/pilot/evidence/runtime-activation/LANE-D-CONFORMANCE.md` — dit bestand

Niet aangeraakt: adapters, sidecar-sources, registry, server.ts, compose-files,
governance-docs, en alle andere lane-paden.

## Wat is gebouwd (1) — vijf-adapter conformance met ECHTE sidecars

`pilot/conformance.test.ts` draait de vijf bindingen niet meer via de
in-proces fase-0-fakehelper maar via de werkelijke sidecar-processen:

- **hermes** start als echt `python3 infra/pilot/hermes/sidecar.py`-subproces
  (stdlib-only) op een vrije 127.0.0.1-poort, met `MODEL_PORT_URL` wijzend naar
  de bestaande OpenAI-fake in de test (`{fake}/v1`, zodat de sidecar
  `/v1/chat/completions` en `/v1/models` bereikt). Waar een python3-interpreter
  bestaat MOET deze binding echt draaien: een startfout is een harde
  testfailure, nooit een stille terugval.
- **agentscope** start als echt `python3 pilot/adapters/agentscope/sidecar.py`-subproces
  met dezelfde `MODEL_PORT_URL`, maar alleen als `python3 -c "import agentscope"`
  lukt. Faalt die probe (het package is een Python-dep die niet overal staat),
  dan valt alleen díe binding terug op de fase-0-fake en registreert de
  modustest dat expliciet (SKIP met reden + TAP-diagnostics).
- Zonder python3 überhaupt (de node:24-alpine JS-gatecontainer) lopen beide
  sidecar-bindingen via de fake en SKIPT de modustest met reden — de suite
  blijft daar groen, maar markeert zichtbaar dat de echte-sidecar-conformance
  in de python-forziene run plaatsvindt.

De in-test OpenAI-fake is verrijkt naar de volledige
chat.completion-vorm (`id`/`object`/`created`/`model`/`usage`) plus
`GET /v1/models` en content-extractie voor zowel kale strings (hermes) als
block-lijsten (agentscope via de openai-client) — precies de vorm die de
gepinde agentscope 2.0.6-stack vereist (zelfde shape als lane-B's
`fake_model.py`). De llamacpp-binding leest alleen
`choices[0].message.content` en is ongemoeid.

Per echte binding assert de test bovendien dat `/health` het vastgelegde
protocolveld `"protocol": "motor-sidecar/1"` draagt.

Alle vijf bindingen (fake-alpha, fake-beta, llamacpp-fake, hermes, agentscope)
doorlopen dezelfde synthetische taak via `runTaskThroughAdapter` met identieke
Employee/Task/Run/Attempt-causaliteit, policy-ID/versie/digest,
ContextManifest-semantiek en -digest, evidenceketen (valide, geen orphans) en
default-deny op muterende capabilities; alleen adapter-metadata verschilt
(`adapterIds.size === 5`). De bestaande failure-evidence-test (adapterfout →
terminale Motor-state + causale failure-evidence, hermes én agentscope) is
ongewijzigd behouden en groen.

Subproces-hygiëne: minimale env (PATH/HOME/PYTHONUNBUFFERED/OTEL_SDK_DISABLED
+ sidecarvars), readiness-poll op `/health` (harde failure met staart van de
procesoutput bij weigering), stop in `finally` met SIGTERM en 5 s
SIGKILL-backstop. Geen gedeelde state tussen bindingen.

## Vijf-adapter matrix — welke binding echt/fake draaide waar

| Binding | Adapter (ongemoeid) | Achterliggende runtime | node:24-alpine (JS-gate) | gecombineerd image (bewijsrun) |
|---|---|---|---|---|
| fake-alpha | pure in-proces fake | — | fake (by design) | fake (by design) |
| fake-beta | pure in-proces fake | — | fake (by design) | fake (by design) |
| llamacpp | echte adapter | in-proces OpenAI-transportfake | transportfake (by design) | transportfake (by design) |
| hermes | echte adapter | `sidecar.py` stdlib-subproces → fake model | **fake-terugval** (geen python3 in alpine; modustest SKIP met reden) | **ECHT** (Python 3.12.12) |
| agentscope | echte adapter | `sidecar.py` met agentscope 2.0.6 → fake model | **fake-terugval** (geen python3/package; modustest SKIP met reden) | **ECHT** (agentscope 2.0.6, hash-locked image) |

Lokaal (macOS, python 3.9.6, geen node): handmatige subprocess-smoke van de
hermes-sidecar tegen een minimale fake — `/health` 200 met protocolveld,
`/invoke` 200 met exacte causale echo en doorgegeven modeloutput.

## Validatiebewijs

**Pass 1 — standaard JS-gate** (builder, schone kloon van CODE_SHA in
`/tmp/pv-d`, `node:24-alpine`):

```text
TESTS_EXIT=0   ℹ pass 180   ℹ fail 0   ℹ skipped 1
               (de skip is de modustest: "python3 ontbreekt hier …" — expliciete registratie)
TYPES_EXIT=0   (tsc --noEmit -p pilot/tsconfig.json)
LINT_EXIT=0    (eslint lib/adr110 pilot --max-warnings 0)
```

**Pass 2 — echte-sidecar-bewijsrun** (builder, zelfde kloon read-only
gemount, `--network none`): wegwerp-image `pilot-conformance-d`
(sha256:16f3ba964bf675bb9d09557004d6f3a511c76fde2a9f731cb2ab69488d550bcf)
= lane-B-image `motor-pilot-agentscope:2.0.6`
(sha256:795ab81fa79e9a5f810b9ddde27c065b1006fa688bfc0e50e1ace928355154db,
python 3.12.12 + agentscope 2.0.6 hash-lock) + node v24.19.0 uit
`node:24-bookworm-slim` (glibc-compatibel). Dockerfile is wegwerp-tooling op
de builder, bewust níét in de repo. De testsuites hebben geen npm-deps
(alleen node-builtins + relatieve .ts-imports), dus geen `npm ci` nodig.

```text
image-check: node v24.19.0 · Python 3.12.12 · agentscope 2.0.6
node --test pilot/conformance.test.ts:
  ✔ conformance: vijf bindingen, één semantiek
  ℹ sidecar-modi: hermes=real (python3: Python 3.12.12); agentscope=real (import agentscope OK)
  ✔ conformance: echte-sidecar-modus is expliciet vastgelegd
  ℹ gemeten modi: hermes=real; agentscope=real
  ✔ conformance: adapterfout → terminale Motor-state + causale failure-evidence
  ℹ pass 3 · fail 0 · skipped 0
volledige suite: FULL_EXIT=0 · ℹ tests 181 · ℹ pass 181 · ℹ fail 0 · ℹ skipped 0
boundary alleen: BOUNDARY_EXIT=0 · ℹ pass 21 · ℹ fail 0
mcp alleen:      MCP_EXIT=0 · ℹ pass 12 · ℹ fail 0
```

`--network none` bewijst dat de volledige run — inclusief beide echte
sidecar-subprocessen — uitsluitend op 127.0.0.1 werkt.

Telling: de integratiebranch telde 180 tests; +1 nieuwe modustest = 181.
Alpine: 180 pass + 1 skip; gecombineerd image: 181 pass + 0 skip.

## Regressiechecklist (2) — bestaande suites groen op deze branch

Geen nieuwe code; elk item is een bestaande suite, gedraaid op CODE_SHA in
beide passes hierboven (exitcodes 0).

| Regressie-item | Suite | Testnamen | Uitslag |
|---|---|---|---|
| draft.decision concurrency/crash/404/409 | `pilot/boundary.test.ts` | 6a (beslissing onbekend concept geweigerd), 6c (onbekende record-types geweigerd), 6d (identiteit/content-type afgedwongen), 7c (20 gelijktijdige identieke settlements → exact één write), 7d (crash na claim vóór append → at-most-once), 7e (2 gelijktijdige beslissingen zelfde concept → exact één record) | 21/21 groen |
| settlement v2 expiry/tamper/replay | `pilot/boundary.test.ts` | 5a (geldig settlement schrijft; replay geweigerd), 5b (ontbrekend/vervalst/gemuteerd/verlopen → geweigerd), 5c (fail-closed zonder secret), 7b (ieder getekend veld afzonderlijk getamperd → DENY) | groen (idem) |
| CONTEXT_MODE fail-closed | `pilot/boundary.test.ts` | 3a (demo gebruikt nooit het privé-volume), 3b (private vereist het volume; geen stille fallback), 3c (415/400 op niet-JSON/meegestuurde context), 7a (ongeldige CONTEXT_MODE faalt gesloten) | groen (idem) |
| geen CORS-wildcard | `pilot/boundary.test.ts` | test 1 (…bevat nooit een CORS-header die cross-origin lezen toestaat; `server.ts` zet bewust géén `Access-Control-Allow-Origin`) | groen (idem) |
| MCP exact één read-only tool + default-DENY | `pilot/mcp.test.ts` | D1 (scoped read → gesanitiseerde snapshot), D2 (onbekende tool → DENY), D3 (extra/ongeldig argument → DENY), D4 (cross-workspace → DENY), D5 (write/publish/mail/payment/device-control → DENY), D6 (ontbrekende scope → DENY), D7 (nooit context/secret/host in response), D9 (geen write-interface), D10 (SDK read-only annotation + Motor-enforcement) | 12/12 groen |
| NUC kiosk-only | artifact-guard (geen test voorzien) | `infra/pilot/nuc/` bevat uitsluitend `README.md` + `motor-pilot-kiosk.sh` (browser-only kiosk naar de tailnet-UI); grep over `infra/pilot/*.yaml`: 0 compose-referenties naar nuc/kiosk — geen service, geen poort, geen taak | stand houdt |

Daarnaast ongemoeid en groen: de 30 hermes-adaptertests, de 13 lane-B
runtime-activation tests, de lane-C agentscope-suite en alle
`lib/adr110`-kernsuites (181 totaal).

## Bewijsclaims

| Claim | Waarde | Bewijs |
|---|---|---|
| FIVE_ADAPTER_CONFORMANCE | **yes** | Vijf bindingen, één synthetische taak, identieke Employee/Task/policy/manifest-digest/evidenceketen; alleen adaptermetadata verschilt (`adapterIds.size===5`); pass 2 met hermes=real én agentscope=real, 181/181 groen onder `--network none` |
| HERMES_CONFORMANCE_REAL | yes | Echt stdlib-subproces; `/health` draagt `motor-sidecar/1`; modustest asserteert echt-zodra-python3 (harde failure bij startfout) |
| AGENTSCOPE_CONFORMANCE_REAL | yes | Echt subproces met agentscope 2.0.6 uit het hash-locked lane-B-image; protocolveld geassert; zonder het package: fake-terugval mét expliciete SKIP-registratie |
| FAILURE_EVIDENCE_PRESERVED | yes | Bestaande failure-test ongewijzigd, groen in beide passes |
| REGRESSION_SUITES_GREEN | yes | Tabel hierboven; boundary 21/21, mcp 12/12, totaal 181/181 |
| REAL_CONTEXT_USED | no | Fake modelendpoint; synthetische taak |
| EXTERNAL_EFFECTS | no | Loopback only; bewijsrun onder `--network none` |
| LIVE_MODEL_CALLS | no | Nooit een echt model aangeroepen |
| PUBLIC_INGRESS | no | Geen gepubliceerde poorten; alleen 127.0.0.1 |
| MASTER_MERGE | no | Alleen branch `pilot/runtime-d-conformance` gepusht |

## Restrisico's

1. **Poortallocatie-race:** de test kiest een vrije loopback-poort en geeft
   die aan het subproces; tussen vrijgeven en binden kan een ander proces de
   poort pakken (theoretisch, ~ms-venster). Een treffer is nooit stil: de
   readiness-poll faalt hard met procesoutput. Nul occurrences gezien.
2. **Twee omgevingen, twee modi:** de standaard JS-gate (node:24-alpine)
   heeft geen python3 en dekt de sidecar-runtime dus NIET — dat is bewust,
   expliciet geregistreerd (SKIP met reden + diagnostics) en hierboven
   gedocumenteerd. Aanbeveling aan de coördinator: neem een python-forzien
   image (of dit gecombineerde image) op in de standaardgate zodra de
   integratiebranch naar een CI-definitie gaat; een groene alpine-run alleen
   is onvoldoende bewijs voor de echte-sidecar-claim.
3. **agentscope-importtijd:** het echte agentscope-subproces importeert de
   2.0.6-stack bij de eerste invoke; de conformance-run kost ~2 s extra.
   Ruim binnen de 60 s-gereedheids- en 30 s-invokegrenzen; geen flaps gezien.
4. **agentscope-fake-terugval dekt de runtime niet:** op een host zonder het
   package is de groene uitslag van díe binding een protocoluitslag, geen
   runtime-uitslag. De modustest maakt dat zichtbaar maar kan niet rood
   worden zonder de JS-gate overal te breken — lees daarom bij iedere run de
   `sidecar-modi`-diagnostic.
5. **Wegwerp-testimage:** `pilot-conformance-d` leeft alleen op de builder
   en is bewust niet in de repo vastgelegd (zou een Dockerfile onder
   `infra/` vereisen = buiten mijn paden). Reproductie: één `FROM
   motor-pilot-agentscope:2.0.6` + `COPY` van node uit
   `node:24-bookworm-slim` (zie Pass 2).
6. **NUC kiosk-only is een artifact-guard:** er bestaat geen geautomatiseerde
   test die de kiosk-topologie afdwingt; de controle is statisch (directory-
   inhoud + compose-grep). Voldoende voor P0.6, maar een CI-guard is een
   aparte keuze voor de coördinator.

REAL_CONTEXT_USED=no · EXTERNAL_EFFECTS=no · PUBLIC_INGRESS=no ·
LIVE_MODEL_CALLS=no · MASTER_MERGE=no · PUSHED=yes (branch pilot/runtime-d-conformance)
