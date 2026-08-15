# LANE-B-AGENTSCOPE — runtime-activatie AgentScope-sidecar (evidence)

Sprint: P0.6 (runtime-activatie) · Lane: B · Branch: `pilot/runtime-b-agentscope`
Datum: 2026-08-15 · Uitvoerder: Cursor-agent (Agent B)

## Checkpoint

```text
BASE_SHA=50dd65dbe1dd70bd5d58d86221b1e587b4d201d9  (origin/pilot/runtime-activation bij lane-start)
EIND_SHA=1bf5f42af4d2ff7c23c47e56ed294995ed97a9e6  (finale validatie hierop groen; deze invulling is de vervolgcommit)
WERKBOOM=/tmp/aihq-p06-b (git worktree op pilot/runtime-b-agentscope, schoon bij start)
BUILDER=Hetzner (x86_64, Docker 29.3.1), node:24-alpine voor JS-validatie,
        python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c
        voor lock-generatie en fake-model
```

Eigen paden (enige schrijver deze lane):

- `ai-motor/pilot/adapters/agentscope/**` — sidecar.py (hersreven), fake_model.py (nieuw),
  requirements.txt (header bijgewerkt), requirements-lock.txt (nieuw)
- `ai-motor/infra/pilot/agentscope/Dockerfile` — install uitsluitend via lock + `--require-hashes`
- `ai-motor/lib/adr110/adapters/agentscope/runtime-activation.test.ts` — nieuw (13 tests)
- `ai-motor/pilot/evidence/runtime-activation/LANE-B-AGENTSCOPE.md` — dit bestand

Niet aangeraakt: `sidecar-client.ts`, `pilot/agentscope.test.ts` (lane-C, semantisch
ongemoeid), `compose.agentscope.yaml`, gedeelde registry/server/UI, hermes-/mcp-/store-
bestanden, `compose.yaml`, governance-docs.

## Verificatie van de echte AgentScope 2.0.6 API vóór edits

De lane-C-skeleton was nooit uitgevoerd; verificatie tegen het gepinde wheel
(`agentscope-2.0.6-py3-none-any.whl`, sha256 `091e7f21…e7ccb8` opnieuw gecheckt met
`sha256sum -c`: OK) toonde drie blokkerende afwijkingen:

1. `OpenAIChatModel` kent géén `model_name=/api_key=/generate_kwargs=`; de 2.0.6-signatuur
   is `(credential=OpenAICredential(api_key=…, base_url=…), model=…, parameters=…,
   stream=…, max_retries=…, client_kwargs=…)`. `base_url` hoort in de credential
   (dubbel via client_kwargs → TypeError).
2. `Toolkit.get_json_schemas()` bestaat niet meer; 2.0.6 heeft async `get_tool_schemas()`.
   De lane-C-guard op de string `get_json_schemas` blijft via een verwijzingscommentaar
   naast de echte assert bestaan.
3. `__call__` slikt `asyncio.CancelledError` en retourneert
   `ChatResponse(finished_reason=FinishedReason.INTERRUPTED)`; de sidecar detecteert dat
   exacte eindmerk en antwoordt 499. Formatter eist echte `Msg`-objecten
   (`isinstance`-assert), geen kale dicts.

Retry is uit op beide niveaus (`max_retries=0` op agentscope én `"max_retries": 0` op de
openai-client): een verborgen retryloop in de sidecar is verboden (fase 0); retry is van
de Motor-engine.

## Gewijzigde/nieuwe bestanden

```text
ai-motor/pilot/adapters/agentscope/sidecar.py        (hersreven: echte 2.0.6-calls,
    protocol motor-sidecar/1 in elk antwoord, echte /health-readiness = model-loop-thread
    + begrensde GET {MODEL_PORT_URL}/models (2 s), één asyncio-loop op daemonthread,
    cancel via run_coroutine_threadsafe-future → INTERRUPTED-detectie → 499,
    504 model_timeout / 502 model_unavailable, 409 dubbele attempt, 1 MiB-caps)
ai-motor/pilot/adapters/agentscope/fake_model.py     (nieuw: stdlib-only OpenAI-stub;
    GET /v1/models + POST /v1/chat/completions; FAKE_MODEL_DELAY_MS / FAKE_MODEL_HANG
    voor timeout-/cancel-bewijs; nooit een echt model, nooit de echte RTX)
ai-motor/pilot/adapters/agentscope/requirements.txt  (header: lock-proces beschreven)
ai-motor/pilot/adapters/agentscope/requirements-lock.txt (nieuw: volledige hash-lock)
ai-motor/infra/pilot/agentscope/Dockerfile           (install alleen uit lock met
    --require-hashes; grep-assert op de lane-C wheel-sha256 in de lock; versie-assert)
ai-motor/lib/adr110/adapters/agentscope/runtime-activation.test.ts (nieuw, 13 tests)
```

## Transitive hash-lock (AGENTSCOPE_TRANSITIVE_HASH_LOCK=yes)

Gegenereerd op de builder, linux/amd64, py3.12, in de exacte base-image:

```text
docker run --rm -v …/pilot/adapters/agentscope:/src -w /src \
  python:3.12.12-slim@sha256:f3fa41d7…209b7c \
  sh -c "pip install -q pip-tools && pip-compile --generate-hashes \
         --output-file requirements-lock.txt requirements.txt"
LOCKGEN_EXIT=0 · pip-tools 7.6.1 · pip 25.0.1
requirements-lock.txt: 2053 regels, 90 packages, 1761 sha256-hashes
agentscope==2.0.6 draagt hash sha256:091e7f214eff7fd6f4934d98a7d7c4bb8707a5d4b33d335def7fc31255e7ccb8
  (identiek aan de lane-C-audit)
Dockerfile installeert uitsluitend: pip install --no-cache-dir --require-hashes -r requirements-lock.txt
```

## Licentie-evidence (AGENTSCOPE_LICENSE_EVIDENCE=yes)

`pip-licenses --with-system` in een wegwerpcontainer van het gebouwde image
(meten: pip-licenses 5.5.5; gereedschap zelf hoort niet in het image/de lock).
96 regels; alle licenties permissief — Apache-2.0, MIT, BSD-2/3-Clause, ISC,
MPL-2.0, PSF-2.0, Unlicense, 0BSD/Zlib/CC0 (numpy-bundling). Geen GPL/AGPL/
copyleft, geen UNKNOWN. Kernregels:

```text
agentscope 2.0.6      Apache-2.0
openai 3.1.0          Apache Software License
mcp 1.29.0            MIT License
anthropic 0.122.0     MIT License
dashscope 1.26.7      Apache Software License
numpy 2.5.2           BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0
httpx 0.28.1          BSD License
opentelemetry-* 1.44.0 Apache-2.0
```

## Builder-validatie (JS-kant)

Uitgevoerd op een ras-immune kloon van exact `origin/pilot/runtime-b-agentscope`
(zie restrisico 1 voor de afwijking van het gedeelde-checkout-pad):

```text
node --test "lib/adr110/*.test.ts" "lib/adr110/adapters/**/*.test.ts" "pilot/*.test.ts"
  TESTS_EXIT=0 · pass 180 / fail 0
tsc --noEmit -p pilot/tsconfig.json    TYPES_EXIT=0
eslint lib/adr110 pilot --max-warnings 0  LINT_EXIT=0
```

De 13 nieuwe lane-B-tests: terminale failure-evidence voor `unavailable` (HTTP 500
én connection refused), `timeout`, `cancelled`, `malformed_response` (elk: juiste code
+ retryable-vlag + causale ids, daarna engine-events → projectie `failed` + valide
causale evidence-keten zonder orphans), protocolversie-acceptatie, en zes artifact-
guards (protocolstring, lane-C-invarianten, dubbele retry-uit, lock-inhoud,
Dockerfile-`--require-hashes`-only, fake_model stdlib-only).

## Containerbewijs (builder, docker build/run/exec)

Image-build van exacte branch-SHA (`--no-cache`):

```text
BUILD_CONTEXT_SHA=3a324a76f6803e2d5d65369977c747abe622ed7d
BUILD_EXIT=0 · 90 packages uit de lock geïnstalleerd · versie-assert op 2.0.6 geslaagd
image motor-pilot-agentscope:2.0.6 = sha256:795ab81fa79e9a5f810b9ddde27c065b1006fa688bfc0e50e1ace928355154db
```

AGENTSCOPE_STARTS=yes — container draait als uid 10001, read-only rootfs:

```text
$ docker logs b-sidecar
sidecar: listening on 0.0.0.0:4410, protocol=motor-sidecar/1, model=motor-fake-model,
toolkit empty, telemetry disabled (agentscope.init never called)
```

Readiness is echt (geen vaste "ok"): bij gestopt fake-model
`{"status":"degraded","checks":{"model_loop":"alive","model_endpoint":"unreachable"}}`;
na herstart weer `"ok"`.

AGENTSCOPE_SYNTHETIC_SMOKE=yes — één synthetische invoke via het FAKE modelendpoint:

```text
GET /health → {"protocol":"motor-sidecar/1","status":"ok","checks":{"model_loop":"alive","model_endpoint":"reachable"}}
POST /invoke {"task_id":"task-b-smoke","run_id":"run-b-smoke","attempt_id":"att-b-smoke","input":"Draft a friendly reply to review #42"}
→ {"protocol":"motor-sidecar/1","output":"synthetic draft: Draft a friendly reply to review #42",
   "task_id":"task-b-smoke","run_id":"run-b-smoke","attempt_id":"att-b-smoke"}   (exacte echo)
```

AGENTSCOPE_TIMEOUT_EVIDENCE=yes — fake-model vertraagd (8000 ms), sidecar
`MODEL_TIMEOUT_MS=2000`:

```text
POST /invoke → HTTP 504 na 3012 ms · {"protocol":"motor-sidecar/1","error":"model_timeout"}
```

AGENTSCOPE_CANCEL_EVIDENCE=yes — fake-model hangt (`FAKE_MODEL_HANG=1`):

```text
POST /cancel {"attempt_id":"att-b-cancel"} → {"protocol":"motor-sidecar/1","cancelled":true} (roundtrip 11 ms)
in-flight invoke eindigt: HTTP 499 {"protocol":"motor-sidecar/1","error":"cancelled","attempt_id":"att-b-cancel"}
onbekende attempt → {"protocol":"motor-sidecar/1","cancelled":false}
```

AGENTSCOPE_NO_TOOLS=yes — lege-Toolkit-startupassert (`get_tool_schemas()==[]` in 2.0.6)
dwingt af dat de container alleen start met nul tools (startup-log "toolkit empty");
statische guards verbieden `register_tool_function`, MCP-import en `agentscope.init(`;
beide retryknoppen staan op 0.

AGENTSCOPE_NO_CONTEXT_MOUNT=yes · AGENTSCOPE_NO_DRAFT_MOUNT=yes:

```text
docker inspect b-sidecar: Mounts=[] · Volumes=map[] · ReadonlyRootfs=true
CapDrop=[ALL] · no-new-privileges:true · User=sidecar
env bevat geen secrets (alleen MODEL_PORT_URL/MODEL_NAME/timeouts/OTEL_SDK_DISABLED)
storepoort 127.0.0.1:4401 vanuit de container: URLError (onbereikbaar)
```

Smoke-opruiming: containers `b-sidecar`/`b-fake` en netwerk `pilot-b-smoke` verwijderd;
image blijft als bouwartifact op de builder staan.

## Restrisico's

1. **Gedeelde builder-checkout is racy.** Tijdens deze lane zette een parallelle lane
   `/opt/motor-pilot/repo` op een andere branch, waarna een image-build uit een vervuild
   `/tmp/pilot-validate` de oude sidecar bevatte (aangetoond: `AttributeError:
   get_json_schemas` uit de skeleton). Hersteld door te bouwen/valideren vanuit een eigen
   kloon op de exacte remote-tracking SHA. Aanbeveling aan de coördinator: per-lane
   validatiedirs verplichten.
2. **Egress** uit de sidecar is compose-technisch een gewone bridge; beperking tot
   uitsluitend het ModelPort-IP vereist host-firewallregels (operatorhandeling, erfde
   lane-C-restrisico, ongewijzigd).
3. **Lock-verversing:** requirements-lock.txt reflecteert PyPI op 2026-08-15; upgrades
   vereisen regeneratie in dezelfde base-image (commando hierboven) plus review van de
   licentie-output.
4. De smoke bewijst de seam tegen een deterministisch fake-model; een echte
   llama.cpp/RTK-aanroep blijft een aparte, expliciet te autoriseren stap
   (`LIVE_MODEL_SMOKE=no`).

## ESCALATIE

Geen blokkerende cross-scope behoeften. Wel gedeeld-leerstuk voor de coördinator:
de fase-0-seam bleek exact draagbaar voor de echte 2.0.6-stack, mits cancel als
`INTERRUPTED`-eindstatus (niet als exception) wordt behandeld; het hermes-spoor kan
dezelfde conventie tegenkomen.

## Verklaringen

```text
AGENTSCOPE_STARTS=yes
AGENTSCOPE_SYNTHETIC_SMOKE=yes
AGENTSCOPE_TRANSITIVE_HASH_LOCK=yes
AGENTSCOPE_LICENSE_EVIDENCE=yes
AGENTSCOPE_TIMEOUT_EVIDENCE=yes
AGENTSCOPE_CANCEL_EVIDENCE=yes
AGENTSCOPE_NO_TOOLS=yes
AGENTSCOPE_NO_CONTEXT_MOUNT=yes
AGENTSCOPE_NO_DRAFT_MOUNT=yes
REAL_CONTEXT_USED=no        (fake modelendpoint; synthetische taak)
EXTERNAL_EFFECTS=no
LIVE_MODEL_SMOKE=no
PUBLIC_INGRESS=no           (sidecar uitsluitend op 127.0.0.1:4410 gepubliceerd)
MASTER_MERGE=no
PUSHED=yes (branch pilot/runtime-b-agentscope, geen merge)
```
