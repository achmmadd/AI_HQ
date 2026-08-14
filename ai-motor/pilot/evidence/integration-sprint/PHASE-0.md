# Fase 0 — gedeelde seam-beslissing (integratiesprint)

Datum: 2026-08-14 · Coördinator: Cursor-agent · Eigenaar: Pietje

## Baseline

```text
BASE_SHA=e3558c5be3bc5aec557c5ffdaf779eff61df6c54  (origin/pilot/spine, CI Pilot Spine success)
SEAM_SHA=de commit die dit bestand introduceert (resolve: `git log -1 --format=%H pilot/integration`)
WERKBOOM=schone kloon van github.com/achmmadd/AI_HQ (geen golf0, geen oude lokale pilot/spine)
```

## Besluit 1 — cancel wordt async-capabel (minimale seam-wijziging)

`CapabilityAdapter.cancel()` was uitsluitend synchroon. Een remote sidecar
(Hermes/AgentScope achter loopback-HTTP) kan een cancel onmogelijk synchroon
beantwoorden — dat is aantoonbaar async. Daarom:

- `cancel()` mag nu `AdapterCancelResult | Promise<AdapterCancelResult>`
  teruggeven, exact hetzelfde patroon als `health()` en `invoke()`.
- Geen andere contractsemantiek gewijzigd. Fake-adapters blijven synchroon;
  `await` op een niet-Promise is geldig, dus bestaande fakes zijn ongemoeid.
- De conformancetest `cancel() acknowledges the attempt` await nu.
- Dit is de enige toegestane seam-wijziging deze sprint; verdere
  contractbehoeften gaan via de coördinator, nooit via een lane-fork.

## Besluit 2 — `simulated_*` metadata blijft (geen contractwijziging)

`AdapterResultMeta.simulated_latency_ms` en `simulated_cost_cents` heten zo
omdat de pure proof ze simuleert. Voor echte adapters vult de adapter er de
gemeten waarde in; de veldnaam is metadata-semantiek, geen meetclaim.
Hernoemen zou de bevroren kern raken zonder veiligheidswinst → UITGESTELD.

## Besluit 3 — één fouttaxonomie voor alle I/O-adapters

`AdapterError.code` is exact één van:

| code | betekenis | retryable |
|---|---|---|
| `unavailable` | sidecar/model onbereikbaar of health ≠ ok | true |
| `timeout` | begrensde wachttijd overschreden | true |
| `cancelled` | attempt is door Motor geannuleerd | false |
| `malformed_response` | kapot/oversized/verkeerd schema | false |
| `causal_mismatch` | task/run/attempt-echo ≠ request | false |

Geen adapter-specifieke codes. Een failure eindigt in een gecontroleerde
terminale Motor-state met causale failure-evidence; nooit in een hangende
Attempt of een adapter-eigen retryloop.

## Besluit 4 — één sidecarprotocol (lanes B/C)

HTTP/JSON, uitsluitend loopback/intern, geen volumes, geen secrets:

- `GET  /health` → `{ "status": "ok" | "degraded" | "down" }` (≤ 5 s)
- `POST /invoke` → body = `{ task_id, run_id, attempt_id, input }`;
  antwoord = `{ output }` mét exacte echo van de drie causal-ID's.
  De Node-adapter verifieert de echo; mismatch → `causal_mismatch`.
- `POST /cancel` → body = `{ attempt_id }`; antwoord `{ cancelled }` (≤ 5 s).

Grenzen: request/response ≤ 1 MiB; invoke-timeout ≤ 120 s; de sidecar
bereikt nooit de storepoort of host-loopback van andere diensten en krijgt
geen `network_mode: host`.

## Lane-branches (allemaal vanaf SEAM_SHA)

```text
pilot/integration-a-hardening
pilot/integration-b-hermes
pilot/integration-c-agentscope
pilot/integration-d-mcp-nuc
```

REAL_CONTEXT_USED=no · EXTERNAL_EFFECTS=no · PUBLIC_INGRESS=no · MASTER_MERGE=no
