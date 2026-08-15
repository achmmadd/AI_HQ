# P0.7 — Live-smoke-gate: Hermes- en AgentScope-sidecars tegen de echte ModelPort

Datum: 2026-08-15 · Branch: `pilot/p07-live-smoke` · Basis: `38fe296` (pilot/runtime-activation)
Uitvoerder: Cursor-agent (P0.7-lane) · Eigenaarsautorisatie: expliciet, eenmalig, voor díe
live-smoke (synthetische taak, tailnet-only, vanaf de builder). Alle overige grenzen bleven
staan: geen echte bedrijfscontext, geen publieke ingress, geen externe effecten, geen
master-merge, geen governance-docs.

## Checkpoint

```text
BASE_SHA=38fe296adaccf5ac8030157caefc902fc7235353  (origin/pilot/runtime-activation bij lane-start)
FIX_SHA=115e1f2e407985d0286df3f9794dbd78fd8a57c2   (enable_thinking-fix + tests; alle suites hierop groen)
WERKBOOM=/tmp/aihq-p07 (git worktree op pilot/p07-live-smoke)
BUILDER=Hetzner via ssh (x86_64, Docker 29.3.1); eigen validatiedir /tmp/pv-p07
MODELPORT=http://100.118.204.123:8080/v1 (llama-server op de RTX-pc, tailnet-only)
MODEL_ID=/home/motorai/models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf  (uit GET /v1/models, data[0].id)
```

Eigen paden (enige schrijver deze lane):

- `ai-motor/infra/pilot/hermes/sidecar.py` — 1 body-veld toegevoegd (zie hieronder)
- `ai-motor/infra/pilot/hermes/test_sidecar.py` — +1 test (body-assertie)
- `ai-motor/pilot/adapters/agentscope/sidecar.py` — 1 constructorparameter toegevoegd
- `ai-motor/pilot/adapters/agentscope/test_sidecar.py` — nieuw (2 tests, body-assertie e2e)
- `ai-motor/pilot/evidence/runtime-activation/P07-LIVE-SMOKE.md` — dit bestand

Niet aangeraakt: compose-overlays (`internal: true` default-deny ongewijzigd), adapters
(hermes/agentscope/llamacpp .ts), registry/server/store, security-guards, CI-bestanden,
governance-docs. De wire-scripts en invoke-payloads waren wegwerp-tooling op de builder
(`/tmp`, na de smoke verwijderd), bewust níét gecommit — zelfde conventie als lane A.

## Stap 1 — Readiness (builder → tailnet)

```text
GET http://100.118.204.123:8080/health  → HTTP 200 {"status":"ok"}
GET http://100.118.204.123:8080/v1/models → data[0].id =
  "/home/motorai/models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf" (owned_by llamacpp,
  n_params=34660610688, Q4_K - Medium, n_ctx=32768)
```

Niets herstart; de server antwoordde direct. (`systemctl is-active motor-pilot-llama`
op de builder zegt "inactive" omdat die unit op de RTX-pc leeft, niet op de builder —
de HTTP-bewijzen hierboven zijn de readiness.)

## Stap 2 — enable_thinking-constatering: NODIG, in beide sidecars

Directe probe op de ModelPort (builder, vaste miniprompt "Noem exact drie woorden over
een lindeboom.", max_tokens=64):

```text
ZONDER chat_template_kwargs:
  HTTP 200 · 0,754 s · finish_reason="length" · completion_tokens=64
  message.content = ""  (LEEG) — alle 64 tokens gingen naar reasoning_content
MET chat_template_kwargs.enable_thinking=false:
  HTTP 200 · 0,250 s · finish_reason="stop" · completion_tokens=6
  message.content = "Grote oude linde"
```

Zonder het veld zou de hermes-sidecar de lege content als
`model_malformed_response` (422, terminaal) en de agentscope-sidecar als
`empty_model_output` (502) weigeren — de live-smoke zou rood zijn ondanks een
gezond model. Dezelfde les als de live-pilot; de llamacpp-Node-adapter
(`lib/adr110/adapters/llamacpp-server.ts`) stuurt het veld daarom al.

**Fix (beide sidecars, body-parameter — geen nieuwe egress, geen nieuwe env):**

- hermes `call_model`: `"chat_template_kwargs": {"enable_thinking": False}` vast in de
  chat.completions-body.
- agentscope `build_model`: `extra_body={"chat_template_kwargs": {"enable_thinking": False}}`
  op `OpenAIChatModel`. Geverifieerd tegen de gepinde 2.0.6-wheel in het image: de
  constructor kent `extra_body` en zet die als `kwargs["extra_body"]` op de
  openai-client-call, die het in de request-JSON merged. (`Parameters` kent wél
  `thinking_enable`/`reasoning_effort`, maar die vertalen niet naar llama.cpp's
  `chat_template_kwargs` — vandaar extra_body.)

**Tests die het veld in de request-body asserten:**

- hermes: `test_invoke_disables_thinking_mode_in_model_body` (in-proces fake-model
  capturet de body) — 21/21 groen lokaal (py3.9) én in de gepinde
  python:3.12.12-slim-image op de builder.
- agentscope: `test_sidecar.py` (nieuw) — draait de ECHTE stack (agentscope 2.0.6 +
  openai-client) tegen een in-proces capture-endpoint op 127.0.0.1 en asserteert
  `chat_template_kwargs == {"enable_thinking": False}` in de ontvangen body, plus
  `model.extra_body` direct op de gebouwde client. SKIPT met expliciete reden waar
  agentscope niet importeerbaar is; waar het package wél bestaat MOET de test draaien
  (zelfde conventie als lane D). Op de builder in het hash-locked image: 2/2 groen,
  inclusief een echte `/invoke → 200` met output-echo door de capture-stub.

Static guards ongemoeid en groen: het veld is een request-bodyparameter (de
S4-security-guards scannen op egress/tooling/env-patronen — geen van die oppervlakken
is geraakt); `max_retries=0` op beide niveaus, lege-Toolkit-startupassertie, env-allowlist
en egress-chokepoints ongewijzigd.

## Stap 3 — Volledige suite op de builder (FIX_SHA, eigen dir /tmp/pv-p07)

```text
node:24-alpine JS-gate:
  TESTS_EXIT=0   ℹ pass 218  ℹ fail 0  ℹ skipped 1
    (de skip is de lane-D-modustest: geen python3 in alpine — expliciete registratie)
  TYPES_EXIT=0   (tsc --noEmit -p pilot/tsconfig.json)
  LINT_EXIT=0    (eslint lib/adr110 pilot --max-warnings 0)

python-unittests (builder):
  hermes  (python:3.12.12-slim@sha256:f3fa41d7…209b7c): Ran 21 tests — OK
  agentscope (motor-pilot-agentscope:2.0.6-image, branch-source gemount): Ran 2 tests — OK
```

## Stap 4 — Image-rebuilds van FIX_SHA (builder)

```text
motor-pilot-hermes-sidecar:0.2.0
  BUILD_EXIT=0 · oud sha256:04224d60a31e… → nieuw sha256:7a14c92b01642ac76b198a546d49a57f0d1184b95a03b985832278d9915b44fa
  grep -c chat_template_kwargs /app/sidecar.py in image = 2  (docstring + body)
motor-pilot-agentscope:2.0.6
  BUILD_EXIT=0 (pip-laag uit cache: lock ongewijzigd; COPY-laag vers) ·
  oud sha256:795ab81fa79e… → nieuw sha256:536675fb14e6f0f9df63641abbe1abe2294bb9f750b6ae7cc9117c939e064f39
  grep -c enable_thinking /app/sidecar.py in image = 1
```

## Stap 5 — Live-smoke (builder, `--network host`, tailnet → RTX-pc)

Bewust NIET de compose-overlay (die is `internal: true` by design — ongewijzigd).
One-shot containers, geen gepubliceerde poorten (host-netwerk, sidecar bindt
127.0.0.1), non-root uid 10001. Vaste synthetische taak voor alle vier de calls:

```text
P07-LIVE-SMOKE synthetische taak: draft een korte, vriendelijke Nederlandse reply
(maximaal 3 zinnen) op een positieve gastreview van het fictieve restaurant De Linde.
Puur synthetisch; geen echte bedrijfsdata.
```

### HERMES_LIVE_SMOKE=yes

```text
container: Up · hermes-sidecar motor-sidecar/1 luistert op http://127.0.0.1:4410
GET  /health → HTTP 200 · 48 ms
  {"protocol":"motor-sidecar/1","status":"ok","detail":"ok"}
POST /invoke → HTTP 200 · 672 ms · protocol motor-sidecar/1 · exacte causale echo
  task_id=task-p07-live-hermes · run_id=run-p07-live · attempt_id=att-p07-live-hermes
  output (eerste 200 tekens):
  "Wat fijn om te lezen dat u een heerlijke avond heeft beleefd in De Linde! We
   waarderen uw positieve woorden zeer en kijken ernaar uit u nogmaals van
   gastvrijheid te mogen verwelkomen."
```

On-wire via de ECHTE Node-adapter (ongewijzigde `adapter.ts`, node:24-alpine,
`--network host`, wegwerp-script):

```text
WIRE_HEALTH  {"adapter_id":"hermes","adapter_version":"0.1.0","status":"ok"}
WIRE_INVOKE  {"ok":true, latency 518 ms, meta.simulated_latency_ms=517,
              simulated_cost_cents=0, exacte ids task-p07-wire-hermes/run-p07-wire/att-p07-wire-hermes}
  output (eerste 200 tekens):
  "Beste gast, wat ontzettend fijn om te lezen dat u een heerlijke avond bij ons
   heeft ervaren! We zijn blij dat uw bezoek aan De Linde zo in de smaak viel en
   kijken uit naar uw volgende bezoek. Met warme groeten, het team van De Linde."
WIRE_EXIT=0
```

### AGENTSCOPE_LIVE_SMOKE=yes

```text
container: Up · log: "sidecar: listening on 127.0.0.1:4410, protocol=motor-sidecar/1,
  model=/home/motorai/models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf, toolkit empty,
  telemetry disabled (agentscope.init never called)"
GET  /health → HTTP 200 · 48 ms
  {"protocol":"motor-sidecar/1","status":"ok",
   "checks":{"model_loop":"alive","model_endpoint":"reachable"}}
POST /invoke → HTTP 200 · 1491 ms · protocol motor-sidecar/1 · exacte causale echo
  task_id=task-p07-live-agentscope · run_id=run-p07-live · attempt_id=att-p07-live-agentscope
  output (eerste 200 tekens):
  "Beste gast, wat ontzettend leuk om te lezen dat u een fijne avond heeft gehad bij
   De Linde. Wij zijn blij dat u genoten heeft van onze gerechten en de sfeer in ons
   restaurant. We hopen u snel weer van harte welkom te heten!"
```

On-wire via de ECHTE Node-adapter (ongewijzigde `sidecar-client.ts`):

```text
WIRE_HEALTH  {"adapter_id":"agentscope","adapter_version":"0.1.0","status":"ok"}
WIRE_INVOKE  {"ok":true, latency 509 ms, meta.simulated_latency_ms=509,
              simulated_cost_cents=0, exacte ids task-p07-wire-agentscope/…/att-p07-wire-agentscope}
  output (eerste 200 tekens):
  "Beste gast, wat fijn om te lezen dat u genoten heeft van uw avond bij De Linde!
   We kijken ernaar uit u snel weer van een heerlijke maaltijd te mogen trakteren.
   Hartelijke groet, het team van De Linde."
WIRE_EXIT=0
```

Opruiming: beide smoke-containers verwijderd (`docker rm -f`), wegwerp-bestanden uit
`/tmp` weg. Beide images blijven als bouwartifact op de builder staan.

## Stap 6 — Gecombineerde node+python conformance-run (lane-D-recept, handmatig bewijs)

Wegwerp-image `pilot-conformance-p07` = NIEUWE `motor-pilot-agentscope:2.0.6`
(python 3.12.12 + agentscope 2.0.6 hash-lock) + node v24.19.0 uit
`node:24-bookworm-slim`. Dockerfile is wegwerp-tooling op de builder (`/tmp`),
bewust níét in de repo. Repo read-only gemount, `--network none`:

```text
COMBINED_BUILD_EXIT=0 · image sha256:a30f12ecbd7f7c6e76b0c02e43c394ee9a73e7b742c69ff3cfcc7272255f7bb2
NODE=v24.19.0 · Python 3.12.12 · agentscope 2.0.6
node --test (volledige suite):
  FULL_EXIT=0 · ℹ tests 219 · ℹ pass 219 · ℹ fail 0 · ℹ skipped 0
  ℹ sidecar-modi: hermes=real (python3: Python 3.12.12); agentscope=real (import agentscope OK)
  ℹ gemeten modi: hermes=real; agentscope=real
hermes unittest in-image:  OK (21) · HERMES_UT_EXIT=0
agentscope unittest in-image: OK (2) · AGENTSCOPE_UT_EXIT=0
```

Telling: 218 pass + 1 modus-skip op alpine; 219 pass + 0 skip in het gecombineerde
image (de modustest draait daar echt). De conformance-suite startte beide ECHTE
sidecar-subprocessen (met de enable_thinking-fix) tegen in-test fakes — alles op
127.0.0.1, bewezen door `--network none`.

## Stap 7 — CI-gate yaml (voor de eigenaar; zelf NIET gepusht — geen workflow-write)

Exact blok om via de web-UI in `.github/workflows/pilot-spine.yml` als extra job
onder `jobs:` te zetten (2 spaties inspringend op job-niveau). Neemt de gecombineerde
node+python-run op in CI zodat de echte-sidecar-conformance niet alleen handmatig
op de builder bewezen wordt:

```yaml
  conformance-real-sidecars:
    # Gecombineerde node+python-run (lane-D-recept, P0.7-bewijs): de
    # conformance-suite start de ECHTE hermes- en agentscope-sidecars als
    # subprocessen tegen in-test fakes. Uitsluitend 127.0.0.1, --network none:
    # nooit een echt model, nooit het tailnet, geen secrets.
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build agentscope sidecar image (hash-locked install)
        run: docker build -f ai-motor/infra/pilot/agentscope/Dockerfile -t motor-pilot-agentscope:2.0.6 ai-motor
      - name: Build combined node+python conformance image
        run: |
          printf '%s\n' \
            'FROM node:24-bookworm-slim AS node' \
            'FROM motor-pilot-agentscope:2.0.6' \
            'COPY --from=node /usr/local/bin/node /usr/local/bin/node' \
            'COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules' \
            > /tmp/Dockerfile.conformance
          docker build -f /tmp/Dockerfile.conformance -t pilot-conformance-ci .
      - name: Full suite, real sidecar subprocesses, no network
        run: |
          docker run --rm --network none -e HOME=/tmp \
            -v "$PWD/ai-motor:/app:ro" -w /app pilot-conformance-ci \
            sh -c 'node --test "lib/adr110/*.test.ts" "lib/adr110/adapters/**/*.test.ts" "pilot/*.test.ts" "pilot/security/*.test.ts"'
      - name: Python sidecar unittests (hermes + agentscope body-asserties)
        run: |
          docker run --rm --network none -e HOME=/tmp -v "$PWD/ai-motor:/app:ro" \
            -w /app/infra/pilot/hermes pilot-conformance-ci python3 -m unittest test_sidecar
          docker run --rm --network none -e HOME=/tmp -v "$PWD/ai-motor:/app:ro" \
            -w /app/pilot/adapters/agentscope pilot-conformance-ci python3 -m unittest test_sidecar
```

Dit exacte recept is hierboven in stap 6 handmatig op de builder gedraaid en groen
(219/219, beide modi real).

## Bewijsclaims

| Claim | Waarde | Bewijs |
|---|---|---|
| HERMES_LIVE_SMOKE | **yes** | Stap 5: /health 200 `ok`; /invoke 200 in 672 ms, niet-lege NL-output, exacte echo, protocol `motor-sidecar/1`; WIRE via echte adapter `ok:true` in 518 ms |
| AGENTSCOPE_LIVE_SMOKE | **yes** | Stap 5: /health 200 `ok` (loop alive + endpoint reachable); /invoke 200 in 1491 ms, niet-lege NL-output, exacte echo; WIRE via echte adapter `ok:true` in 509 ms |
| ENABLE_THINKING_FIX_NEEDED | **yes (beide sidecars)** | Stap 2: zonder veld content="" (64/64 tokens reasoning); met veld finish_reason=stop met content |
| ENABLE_THINKING_FIX_TESTED | yes | Body-assertietests: hermes 21/21, agentscope 2/2 (echte stack, capture-endpoint) |
| FULL_SUITE_GREEN | yes | Stap 3: 218/0 (+1 skip) alpine-gate, TYPES/LINT 0; stap 6: 219/219/0 skip gecombineerd, beide modi real |
| CI_GATE_YAML_READY | yes | Stap 7: exact blok; recept handmatig gevalideerd |
| REAL_CONTEXT_USED | no | Vaste synthetische De Linde-tekst; geen bedrijfsdata |
| EXTERNAL_EFFECTS | no | Alleen inference-calls naar het lokale model; geen writes buiten de builder |
| PUBLIC_INGRESS | no | Host-netwerk met loopback-bind; geen gepubliceerde poorten; tailnet-only |
| MASTER_MERGE | no | Alleen branch `pilot/p07-live-smoke` |
| COMPOSE_DEFAULT_DENY_UNCHANGED | yes | Geen overlay geraakt; smokes als aparte one-shot containers |

## Restrisico's

1. **`--network host` op de builder** gaf de smoke-containers het hele host-netwerk-
   zicht (incl. tailnet) voor de duur van de smoke. Bewust gekozen om de
   compose-overlay niet te hoeven openen; containers zijn verwijderd. De
   default-deny-overlay is ongemoeid — een structurele tailnet-aansluiting is een
   aparte netwerkbeslissing met eigen goedkeuring.
2. **Het veld is vast, niet configureerbaar.** De llamacpp-adapter kent
   `enableThinking` als optie (default false); de sidecars zetten het veld
   onvoorwaardelijk op false omdat het fase-0-contract niet-lege `content` eist en
   er geen pilot-toepassing voor deliberatie-output is. Wil een toekomstige lane
   thinking mode aanzetten, dan is dat een bewuste codewijziging met review —
   dat is de bedoeling, maar het is wel een asymmetrie met de adapter.
3. **MODEL_NAME-matching:** llama-server in single-model-modus accepteert de
   meegestuurde modelnaam zonder strikte match; de smoke gebruikte het exacte
   `/models`-id. Bij een toekomstige router-/multi-model-setup moet MODEL_NAME
   exact overeenkomen met een geladen alias.
4. **Model-id is een pad** (`/home/motorai/models/….gguf`). Het lekt via
   `/v1/models` naar elke tailnet-client — bekend llama.cpp-gedrag, geen nieuwe
   blootstelling door deze lane, maar noemenswaard voor de tailnet-ACL-review.
5. **CI-yaml is niet door CI bewezen** (geen workflow-write in deze lane): het
   recept is handmatig op de builder gedraaid en groen, maar de GitHub-runner-
   variant kan afwijken (bijv. docker-socket-rechten). Eerste echte run na het
   plakken door de eigenaar is het definitieve bewijs.
6. **Smoke-dekking is happy-path + readiness.** Timeout/cancel/malformed tegen
   het ECHTE model zijn niet live herhaald (dat gedrag is tegen fakes bewezen in
   lane A/B + unittests); live failure-injectie zou extra modelbelasting en
   langere runs vereisen — aparte autorisatie.

```text
HERMES_LIVE_SMOKE=yes
AGENTSCOPE_LIVE_SMOKE=yes
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
PUSHED=yes (branch pilot/p07-live-smoke, geen merge)
```
