# Spoor A — Hermes-adapterseam runtime-activatie (sprint P0.6)

Datum: 2026-08-15 · Branch: `pilot/runtime-a-hermes` · Basis: `50dd65d` (pilot/runtime-activation)
Protocol/taxonomie: [`../integration-sprint/PHASE-0.md`](../integration-sprint/PHASE-0.md), exact gevolgd.
Voortbouwend op: [`../integration-sprint/LANE-B.md`](../integration-sprint/LANE-B.md) (501-skeleton).

## Wat is geactiveerd

`infra/pilot/hermes/sidecar.py` is geen skeleton meer maar de werkelijke
Motor-Hermes-runtime: bewust Python-stdlib-only, want er bestaat geen extern
te pinnen "Hermes"-package — het proces IS de runtime. `/invoke` voert de
synthetische taak uit via één OpenAI-compatible
`POST {MODEL_PORT_URL}/chat/completions` (`stream: false`, geen tools, geen
conversation state) en echoot `task_id`/`run_id`/`attempt_id` verbatim.
`/health` rapporteert echte readiness: een begrensde probe (2 s) op
`{MODEL_PORT_URL}/models` — proces op + model bereikbaar → `ok`, anders
`degraded`, nooit vals groen. `/cancel` annuleert een in-flight attempt via
een per-attempt registry (token + `shutdown(SHUT_RDWR)` op de live
modelverbinding). Elk antwoord — ook fouten en 404's — draagt
`"protocol": "motor-sidecar/1"`.

| Bestand | Inhoud |
|---|---|
| `infra/pilot/hermes/sidecar.py` | Bedraade runtime (herschr.) |
| `infra/pilot/hermes/Dockerfile` | `python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c` (zelfde pin als lane C, Docker Hub API v2 2026-08-14), non-root uid 10001, nul pip-afhankelijkheden |
| `infra/pilot/hermes/env.example` | Fictieve waarden: `MODEL_PORT_URL`, `MODEL_NAME`, `HERMES_SIDECAR_PORT`, `MODEL_REQUEST_TIMEOUT_S` |
| `infra/pilot/hermes/fake_model.py` | Synthetisch OpenAI-compatible endpoint voor tests/smokes (`FAKE_MODEL_SLEEP_MS`, `FAKE_MODEL_MODE=malformed`) |
| `infra/pilot/hermes/test_sidecar.py` | 20 stdlib-unittests (in-proces loopback, nul externe I/O) |
| `infra/pilot/compose.hermes.yaml` | Aangescherpt: build uit gepinde Dockerfile i.p.v. zwevende `python:3-alpine`-tag; **alle volumes weg** (ook de lane-B repo-mount); read_only/cap_drop ALL/no-new-privileges/non-root/intern netwerk behouden; yaml geverifieerd met `docker compose config` |

`lib/adr110/adapters/hermes/adapter.ts` en `adapter.test.ts` zijn **ongemoeid**
(geen semantische wijziging; de 30 bestaande adaptertests draaien onveranderd
groen). Geen andere sporen, registry, server.ts of governance-docs geraakt.

## Foutmapping (sidecar HTTP → adapter-taxonomie, ongewijzigd adaptergedrag)

| Sidecar-antwoord | Adaptercode | retryable |
|---|---|---|
| 503 `model_unavailable` (endpoint down / model 429/5xx) | `unavailable` | true |
| 504 `model_timeout` (begrensde model-wachttijd overschreden) | `unavailable` | true |
| 422 `model_malformed_response` (kapot/oversized/verkeerd schema, model-4xx) | `malformed_response` | false (terminaal) |
| 200 `{"cancelled": true}` na `/cancel` | (adapter abortte al lokaal) → `cancelled` | false (terminaal) |
| 500 `internal_error` (onverwacht) | `unavailable` | true |

Bewuste keuze: een kapot modelantwoord is een terminale *deny*
(`malformed_response`), geen retry — fase 0 verbiedt adapter-eigen
retryloops en de taxonomie kent geen "rejected"-code. Een model-4xx (bijv.
onbekende modelnaam = misconfiguratie) valt in dezelfde terminale klasse.

## Builder-validatie (Hetzner, schone kopie van CODE_SHA `48ad2af5c7de138d1170cb43b703cbf8e079a82c`)

```text
TESTS_EXIT=0   ℹ pass 167   ℹ fail 0   (node:24-alpine; waaronder de 30 hermes-adaptertests, ongewijzigd)
TYPES_EXIT=0   (tsc --noEmit -p pilot/tsconfig.json)
LINT_EXIT=0    (eslint lib/adr110 pilot --max-warnings 0)
python3 -m unittest test_sidecar   → Ran 20 tests — OK  (host python 3.12.3)
```

Lokaal (macOS, python 3.9.6): `py_compile` + dezelfde 20 tests OK.

## Containerbewijs (Hetzner docker 29.3.1)

Image: `motor-hermes-test` = `sha256:5015213428447f39660e2fd0bbe3efc6a933fea34fbbaf6778dbf7541615e263`.

**Start + readiness** (model bewust onbereikbaar, `MODEL_PORT_URL=http://127.0.0.1:9`):

```text
STATUS=running  USER=sidecar  PORTS=[]
/health → {"protocol": "motor-sidecar/1", "status": "degraded", "detail": "model_unreachable_or_unconfigured"}
```

Eerlijkheid van readiness: het proces serveert (HTTP 200) maar rapporteert
`degraded` — geen statisch "ok" meer zoals in het skeleton.

**Synthetische smokes** — eigen `--internal` netwerk (geen egress, geen
gepubliceerde poorten), fake-modelcontainers (`fake_model.py`), clientcalls
vanuit een derde container op hetzelfde netwerk:

```text
NET_INTERNAL=true
A_HEALTH  200 {"status": "ok", "protocol": "motor-sidecar/1", ...}
A_INVOKE  200 {"output": "fake-draft: Synthetische rooktaak alpha",
               "task_id": "task-smoke-a", "run_id": "run-smoke-a",
               "attempt_id": "att-smoke-a", "protocol": "motor-sidecar/1"}
B_TIMEOUT 504 {"error": "model_timeout", ...echo...}  elapsed_s=2.0  (model 30 s traag, grens 2 s)
C_CANCEL  cancel=[200 {"cancelled": true}], invoke=[200 {"cancelled": true, ...echo...}]
          elapsed_s=1.0  invoke_alive=False                          (model 30 s traag)
D_MALFORMED 422 {"error": "model_malformed_response", ...echo...}   (kapotte JSON van het model)
E_EGRESS  urlopen https://example.invalid → Temporary failure in name resolution  (intern netwerk: geen egress)
```

**On-wire via de echte Node-adapter** (ongewijzigde `adapter.ts`, node:24-alpine
op hetzelfde interne netwerk; wegwerp-script, niet gecommit):

```text
WIRE_OK              {"ok":true,"output":"fake-draft: Synthetische draadtaak",
                      "meta":{"adapter_id":"hermes","adapter_version":"0.1.0",
                      "simulated_latency_ms":60,"simulated_cost_cents":0, ...exacte ids...}}
WIRE_MALFORMED       {"ok":false,"code":"malformed_response","retryable":false}
WIRE_SIDECAR_TIMEOUT {"ok":false,"code":"unavailable","retryable":true}   (sidecar-504)
WIRE_CLIENT_TIMEOUT  {"ok":false,"code":"timeout","retryable":true}      (adaptergrens 1 s)
WIRE_CANCEL          {"cancelled":true,"ok":false,"code":"cancelled","retryable":false}
WIRE_UNAVAILABLE     {"ok":false,"code":"unavailable","retryable":true}  (connection refused)
WIRE_HEALTH_REFUSED  {"status":"down", ...}
```

**Compose-overlay zelf gestart** (`docker compose -p hermes-overlay-test -f
compose.hermes.yaml up -d --build`, fictieve env): `Up`, `/health` 200 met
protocolveld, `read_only_rootfs=true`, `capdrop=[ALL]`,
`ports=map[4410/tcp:[]]` (EXPOSE zonder enige host-publicatie). `docker
compose config` rendert zonder `ports`- en zonder `volumes`-sleutel.

## Bewijsclaims

| Claim | Waarde | Bewijs |
|---|---|---|
| HERMES_STARTS | yes | Container start als non-root `sidecar`, nul gepubliceerde poorten, `/health` 200 met protocolveld; overlay boot identiek |
| HERMES_SYNTHETIC_SMOKE | yes | A_INVOKE 200 met exacte causale echo + output van fake endpoint; WIRE_OK via de echte adapter (latency 60 ms, cost 0) |
| HERMES_TIMEOUT_EVIDENCE | yes | Unittest `test_timeout_is_bounded_and_controlled` (504 ruim onder de 30 s); smoke B 504 in 2,0 s; on-wire: sidecar-504 → `unavailable`(retryable), adaptergrens → `timeout`(retryable) |
| HERMES_CANCEL_EVIDENCE | yes | Unittest: in-flight invoke breekt < 10 s (model 30 s) met `cancelled: true`; smoke C in 1,0 s; on-wire: `cancelled`(terminaal) + lokale abort |
| HERMES_MALFORMED_RESPONSE_DENY | yes | Unittests: 6 varianten (kapotte JSON, geen choices, lege/non-string content, model-400, oversized) → 422; smoke D → 422; on-wire → `malformed_response`(terminaal) |
| HERMES_NO_TOOLS | yes | `sidecar.py` doet exact één `chat/completions`-call met `stream: false`; geen tool-/function-velden, geen framework-imports, stdlib-only |
| HERMES_NO_CONTEXT_MOUNT | yes | Overlay heeft geen `volumes`-sleutel (compose config-bewijs); image bevat alleen `sidecar.py`; rootfs read-only |
| HERMES_NO_DRAFT_MOUNT | yes | Idem: geen enkele mount — de lane-B repo-mount is verwijderd; de sidecar is stateless en ziet geen repo, drafts of context |

## Restrisico's

- **Model-egress is bewust dicht:** `hermes-net` is `internal: true`; de
  sidecar bereikt daar alleen endpoints op dat netwerk (zoals de fake).
  Aansluiting op het echte tailnet-model vereist een aparte, bewuste
  netwerkwijziging met voorafgaande eigenaarsgoedkeuring — bewust niet
  hier opengemaakt.
- **Cancel tijdens het verbindingsstadium:** `shutdown()` breekt een
  geblokkeerde read betrouwbaar af (bewezen), maar een cancel midden in
  TCP-connect hangt theoretisch tot de begrensde connect-timeout; de
  attempt eindigt alsnog gecontroleerd, alleen minder prompt.
- **Health-probe per call:** elke `/health` doet een ≤ 2 s probe op
  `/models`; geen cache. Bij een flappend model kan readiness flippen —
  dat is de bedoeling (echte readiness), maar monitoring moet niet op
  elke individuele uitslag alarmen.
- **Adapter ongewijzigd tegen fakes + wire:** de 30 adaptertests zijn
  ongemoeid; het on-wire bewijs hierboven is een wegwerp-smoke, geen
  CI-test. Een permanente gecontaineriseerde wiretest in CI is een
  afzonderlijke keuze voor de coördinator.
- **`MODEL_REQUEST_TIMEOUT_S` vs adapter-timeout:** deployments moeten de
  sidecargrens onder de adapter-invokegrens (≤ 120 s) houden, anders wint
  de client-timeout en verschuift de taxonomie van `unavailable` naar
  `timeout` (beide retryable — geen veiligheidsverschil, wel andere
  failure-semantiek).

REAL_CONTEXT_USED=no · EXTERNAL_EFFECTS=no · PUBLIC_INGRESS=no ·
LIVE_MODEL_CALLS=no (alleen fake endpoints) · MASTER_MERGE=no
