# Spoor B — Hermes-adapter achter het CapabilityAdapter-contract

Datum: 2026-08-14 · Branch: `pilot/integration-b-hermes` · Basis: `65185e2` (pilot/spine + fase-0 seam)
Protocol/taxonomie: [`PHASE-0.md`](PHASE-0.md), exact gevolgd.

## Wat is nieuw gebouwd

| Bestand | Inhoud |
|---|---|
| `lib/adr110/adapters/hermes/adapter.ts` | CapabilityAdapter `hermes` v0.1.0 tegen een Hermes-runtime via het fase-0 sidecarprotocol (`GET /health`, `POST /invoke`, `POST /cancel`; HTTP/JSON, ≤ 1 MiB, invoke ≤ 120 s, handshake ≤ 5 s). `baseUrl` uitsluitend via constructor-config; async cancel (seam-besluit 1) met lokale abort + sidecar-`/cancel`; causale echo-verificatie; uitsluitend de vijf fase-0 foutcodes. `simulated_latency_ms` draagt de gemeten round-trip, `simulated_cost_cents` is 0 (besluit 2). |
| `lib/adr110/adapters/hermes/adapter.test.ts` | 30 tests: contractvorm/statelessheid, config-validatie, health-mapping, protocolbody (exact `task_id/run_id/attempt_id/input` — geen manifest/agent over de grens), hele fouttaxonomie (timeout/unavailable/malformed_response/causal_mismatch), async cancel, 1 MiB-grenzen, plus één echte loopback-wiretest (127.0.0.1, in-proces server). |
| `infra/pilot/hermes/sidecar.py` | Minimaal sidecar-skeleton, uitsluitend Python-stdlib, importeerbaar zonder dependencies en zonder server te starten. Spreekt het protocol inclusief 1 MiB-grens en causale echo. Echte Hermes-calls: `TODO(hermes-wire)`; `/invoke` antwoordt eerlijk `501 hermes_runtime_not_wired` zolang de runtime niet bedraad is. Geen Hermes-import, geen secrets. |
| `infra/pilot/compose.hermes.yaml` | Aparte compose-overlay: `read_only`, `cap_drop ALL`, `no-new-privileges`, non-root (uid 1000), geen volumes, geen publieke poorten en geen host-netwerkmodus — alleen het interne netwerk `hermes-net` (`internal: true`, geen egress). Env via `${HERMES_SIDECAR_PORT:?}`; fictieve .env-waarden in commentaar gedocumenteerd. |
| `pilot/evidence/integration-sprint/LANE-B.md` | Dit rapport. |

## Wat is hergebruikt

Niets. Alles is nieuw geschreven. De adapter importeert alleen de ADR-110-kern
(`contract.ts`, `types.ts`, `digest.ts`) en de tests importeren `scenario.ts` /
`fake-alpha.ts` voor fixtures — dat is de bevroren seam zelf, geen legacy.

## Welke legacy is geweigerd

- Geen imports uit `factory-os/`, `holding/`, `evomap/`, `omega*`, `singularity*`,
  `ai-motor/app` of `ai-motor/lib` buiten `lib/adr110`.
- Geen Hermes-installatie, geen `pip install`, geen derde-partij Python-imports.
- Geen echte endpoints, IP's, hostnames of bedrijfsdata in code, tests of docs;
  de enige URL in tests is de fictieve loopback `http://127.0.0.1:4410`.
- Geen wijzigingen aan bestanden van andere sporen (`pilot/server.ts`,
  `draft-core.ts`, `decision-core.ts`, `store-service.ts`, `settlement.ts`,
  `boundary.test.ts`, `infra/pilot/compose.yaml`) en geen governance-docs.
- `pilot/tsconfig.json` onaangepast: de bestaande include `../lib/adr110/**/*.ts`
  dekt de nieuwe `adapters/hermes/`-map al.

## Testresultaten

Hetzner-builder (docker `node:24-alpine`, schone kopie van commit `fd6cd20`):

```text
TESTS_EXIT=0   ℹ pass 114   ℹ fail 0   (waarvan 30 nieuwe hermes-tests)
TYPES_EXIT=0   (tsc --noEmit -p pilot/tsconfig.json)
LINT_EXIT=0    (eslint lib/adr110 pilot --max-warnings 0)
```

Aanvullend lokaal (geen node aanwezig): `python3 -m py_compile` op
`sidecar.py` geslaagd; import zonder dependencies geslaagd; registry- en
NotImplementedError-gedrag van het skeleton direct geverifieerd.

## Resterende risico's

- **Skeleton, geen runtime:** `sidecar.py` bedraadt Hermes nog niet
  (`TODO(hermes-wire)`); `/health` rapporteert statisch `ok` en `/invoke`
  antwoordt 501. Echte bedrading vereist een aparte expliciete taak.
- **Overlay niet live gestart:** `compose.hermes.yaml` is deze sprint nooit
  gestart of tegen een daemon geverifieerd (geen containers op Hetzner
  gestart). De Motor-API zit nog niet op `hermes-net`; die koppeling is een
  aparte wijziging op een ander spoor.
- **Adapter alleen tegen fakes getest:** gescripte in-proces sidecar + één
  loopback-wiretest; gedrag tegen een echte Hermes-runtime is onbekend,
  meten door operator zodra de runtime bedraad is.
- **Taxonomie-interpretatie:** HTTP 4xx (niet-429) mapt op
  `malformed_response` (terminaal), omdat de fase-0-taxonomie geen
  "rejected"-code kent; ter bevestiging voorleggen aan de coördinator wanneer
  de lanes samenkomen.
- **Cancel-semantiek:** `cancelled: true` reflecteert de lokale abort ook als
  de sidecar onbereikbaar is — de remote toestand is dan onbekend (bewuste
  keuze, gedocumenteerd in de adapter-header).
