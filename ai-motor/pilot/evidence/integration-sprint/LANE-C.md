# LANE-C — AgentScope CapabilityAdapter (evidence)

Lane: C · Branch: `pilot/integration-c-agentscope` · Worktree: `/tmp/aihq-lane-c`
Datum: 2026-08-14 · Uitvoerder: Cursor-agent (lane C)

## Checkpoint (vóór edits)

```text
BASE_SHA=e3558c5be3bc5aec557c5ffdaf779eff61df6c54   (origin/pilot/spine, CI run 17 success)
SEAM_SHA=65185e23fdc6c5879eafc839478f98acb926ad13   (pilot/integration fase-0 seam)
START_SHA=65185e23fdc6c5879eafc839478f98acb926ad13  (lane C start = SEAM_SHA)
EIND_SHA=<wordt ingevuld bij afronding>
WERKBOOM=schoon bij start (git status --short leeg op SEAM_SHA)
```

Eigen paden (enige schrijver in deze lane):

- `ai-motor/lib/adr110/adapters/agentscope/**` — nieuwe Node-adapter
- `ai-motor/pilot/adapters/agentscope/**` — nieuwe Python-sidecar
- `ai-motor/infra/pilot/agentscope/**` + `ai-motor/infra/pilot/compose.agentscope.yaml`
- `ai-motor/pilot/agentscope.test.ts` — top-level in `pilot/` (testglob `pilot/*.test.ts`)
- `ai-motor/pilot/evidence/integration-sprint/LANE-C.md` — dit bestand

Bevroren/niet-aangeraakt: `lib/adr110/types.ts`, `context.ts`, `engine.ts`,
`gateway.ts`, `evidence.ts`, `evaluation.ts`, `adapters/contract.ts`,
bestaande `pilot/*`, bestaande `infra/pilot/compose.yaml` + `.env.example`,
andere lanes' paden.

Open vragen bij start: geen blokkerende. Async cancel is in fase 0 al
besloten (seam-sha hierboven); deze lane implementeert dat besluit alleen.

## Dependency- en licentie-audit (AgentScope)

Bronnen: GitHub API (`repos/agentscope-ai/agentscope`, release v2.0.6, tag-ref),
PyPI JSON API (`pypi.org/pypi/agentscope/json`), officiële docs
(`doc.agentscope.io/tutorial/task_model.html`, `task_tool.html`,
`task_tracing.html`). Alle waarden hieronder zijn op 2026-08-14 opgehaald.

| Onderdeel | Vastgelegde waarde |
|---|---|
| Package | `agentscope` (PyPI) |
| Gepinde versie | **`2.0.6`** (exact, `==`, geen `latest`) |
| Upstream tag/commit | `v2.0.6` = commit `29b592358c2e983a0d10dd5227316b7a02d8c23a` |
| Release-datum | 2026-08-07 (GitHub release 366680192) |
| Licentie | **Apache-2.0** (GitHub API `license.spdx_id`; PyPI `license_expression`) |
| Python | `>=3.11` (PyPI `requires_python`); sidecar-image gebruikt Python 3.12 |
| Wheel sha256 (PyPI) | `091e7f214eff7fd6f4934d98a7d7c4bb8707a5d4b33d335def7fc31255e7ccb8` (`agentscope-2.0.6-py3-none-any.whl`) |
| sdist sha256 (PyPI) | `5fcf2be7b56dabc2ebb616c8999f8ba299355ba4cbae9ac0d4f777ad04e7e3f6` |
| Basisimage | `python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c` (Docker Hub API, 2026-08-14) |

### Transitive-dependency-aanpak

- De directe dependency is exact gepind (`agentscope==2.0.6`) en de
  Dockerfile verifieert de **wheel-sha256** vóór installatie
  (`pip download --no-deps` + `sha256sum -c`).
- Transitive deps (o.a. `openai`, `httpx`, `mcp<2.0.0`, `opentelemetry-*`,
  `anthropic`, `dashscope`, `numpy` — kernlijst uit PyPI `requires_dist`)
  worden door pip op image-build opgelost. Een volledige
  hash-lock (`pip-compile --generate-hashes` voor `linux/amd64`, py3.12) is
  **verplicht vóór elk live gebruik** en is bewust geen P0-blokkade: CI bouwt
  dit image niet en de tests draaien tegen een deterministische fake sidecar.
  Zie restrisico's.
- De sidecar installeert géén extras (`full`, `service`, `workspace-*`,
  `tools`, `rag`, `vdb-*`, `memory-*` blijven allemaal weg).

### Telemetry / tracing / memory / toolkit (standaardstand)

- **Tracing/telemetry:** AgentScope-tracing (OpenTelemetry) is opt-in via
  `agentscope.init(studio_url=…)` of `agentscope.init(tracing_url=…)`
  (docs `task_tracing.html`). De sidecar roept `agentscope.init` **nooit**
  aan → er verlaat geen trace/telemetry het proces. Defense-in-depth:
  compose zet `OTEL_SDK_DISABLED=true`.
- **Memory:** geen memory-backend geconfigureerd; de sidecar houdt alleen een
  vluchtig in-flight cancel-register per attempt (geen SSOT, geen disk).
- **Toolkit:** `Toolkit()` start leeg; tools bestaan alleen na expliciete
  `register_tool_function` (docs `task_tool.html`). De sidecar maakt één lege
  Toolkit, asserteert bij opstarten `get_json_schemas() == []` en geeft hem
  nergens aan mee. Geen shell/files/code/browser/MCP — de `mcp`-clientlib is
  een transitive dep maar wordt nooit geïmporteerd of aangeroepen.
- **Modelroute:** `OpenAIChatModel(client_kwargs={"base_url": MODEL_PORT_URL})`
  (docs `task_model.html`) — uitsluitend Motor's ModelPort; géén
  cloudproviderfallback, géén echte API-key (llama.cpp negeert de
  placeholder-waarde).

## Protocol en fouttaxonomie (uit PHASE-0.md, ongewijzigd gevolgd)

- `GET /health` → `{status: ok|degraded|down}` (≤ 5 s)
- `POST /invoke` → `{task_id, run_id, attempt_id, input}`; antwoord
  `{output, task_id, run_id, attempt_id}` met exacte echo; adapter
  verifieert de echo (mismatch → `causal_mismatch`)
- `POST /cancel` → `{attempt_id}`; antwoord `{cancelled}` (≤ 5 s)
- Request/response ≤ 1 MiB; invoke-timeout ≤ 120 s
- Foutcodes exact: `unavailable` (retryable), `timeout` (retryable),
  `cancelled` (niet retryable), `malformed_response` (niet retryable),
  `causal_mismatch` (niet retryable)

Mapping-besluiten binnen die taxonomie (lane-intern, gedocumenteerd):

- HTTP ≠ 2xx van de sidecar → `unavailable`; retryable alleen bij 429/5xx.
- Requestbody > 1 MiB → `malformed_response` (retryable=false) vóór verzenden;
  er gaat dan géén HTTP-request uit.
- Antwoord zonder echovelden of met kapot schema → `malformed_response`;
  aanwezige maar afwijkende echo-waarden → `causal_mismatch`.
- `cancel()` is best-effort en gooit nooit: lokale abort van de in-flight
  fetch plus `POST /cancel`; `cancelled = lokale abort || remote ack`.

## Gewijzigde/nieuwe bestanden

<wordt bij afronding ingevuld — exacte lijst via git>

## Uitgevoerde commando's + exitcodes

<wordt bij afronding ingevuld>

## Testaantallen

<wordt bij afronding ingevuld — positief/negatief>

## Niet live getest

- De echte Python-sidecar is **niet** uitgevoerd (geen AgentScope-installatie,
  geen model, geen netwerk in deze lane). CI en lokale tests gebruiken een
  deterministische fake Node-sidecar.
- Het Docker-image is **niet** gebouwd; Dockerfile/compose zijn
  reviewartefacten voor de latere, apart geautoriseerde live smoke.
- Geen live Qwen/ModelPort-aanroep: `LIVE_MODEL_SMOKE=no`.

## Restrisico's

<wordt bij afronding aangevuld>

- Transitive Python-deps zijn niet volledig hash-gelockt (zie audit);
  vereist `pip-compile --generate-hashes` vóór live gebruik.
- Egress uit de sidecar is compose-technisch een gewone bridge; beperking tot
  alleen de ModelPort vereist host-firewallregels (operatorhandeling,
  gedocumenteerd in `infra/pilot/compose.agentscope.yaml`).

## ESCALATIE

<geen — of exacte cross-scope behoefte aan de coördinator>

## Verklaringen

```text
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
LIVE_MODEL_SMOKE=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
PUSHED=no
```
