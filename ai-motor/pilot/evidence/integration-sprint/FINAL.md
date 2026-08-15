# FINAL — integratiesprint P0 (coördinator)

> **Datum:** 2026-08-14 · **Branch:** `pilot/integration` · **Eigenaar:** Pietje

## SHAs

```text
BASE_SHA=e3558c5be3bc5aec557c5ffdaf779eff61df6c54        (pilot/spine)
SEAM_SHA=65185e23fdc6c5879eafc839478f98acb926ad13        (fase 0: async cancel + taxonomie + sidecarprotocol)
LANE_A_SHA=1273a9dfa31468e4d47425ec43f31316056c11c6     (hardening: settlement v2, atomaire claims, CONTEXT_MODE fail-closed)
LANE_B_SHA=6768f64b5c8cca294b038843f606da839e3a16f9     (Hermes CapabilityAdapter + sidecar-skeleton)
LANE_C_SHA=cb919bac379bdb00090bf73bca817ad297b18b1b     (AgentScope CapabilityAdapter + sidecar + overlay)
LANE_D_SHA=8379b67e61b6afbdeee2f2924e320e8cc224d11b     (read-only MCP-pad + NUC-kiosk)
INTEGRATION_SHA=91838154c08cd4a8fd4aed474cd396ee1b7d6c7e (+ dit evidencebestand in de volgende commit)
```

## Acceptatiematrix

| Gate | Bewijs | Status |
|---|---|---|
| Baseline | BASE_SHA + schone start, lanes vanaf SEAM_SHA | GREEN |
| Supply chain | AgentScope 2.0.6 exact gepind + wheel-sha256 + Apache-2.0 (LANE-C); Hermes/MCP: geen nieuwe runtime-deps; SDK-pin bewust uitgesteld (LANE-D) | GREEN |
| Core regressie | ADR-110-proof-tests groen (ongemoeid) | GREEN |
| Pilot regressie | bestaande + nieuwe pilottests groen | GREEN |
| Type/lint | tsc + eslint groen op alle nieuwe paden | GREEN |
| Hardening | context/CORS/tamper-per-veld/expiry/concurrency/crash/mountmatrix negatief getest (7a–7g) | GREEN |
| Decision loop | approved/rejected append-only, 404/409, beslis-race (7e), publish na approval DENY (7f) | GREEN |
| Adapter swap | conformancetest: fake-alpha/fake-beta/llamacpp-fake/hermes-fake/agentscope-fake — identieke Employee/Task/policy/manifest/keten; alleen binding verschilt | GREEN |
| Failure | unavailable → terminale `failed`-state + valide failure-evidence (hermes + agentscope); timeout/cancel per lane | GREEN |
| MCP | exact één readtool; unknown/write/publish/device-control DENY (D1–D12) + live DENY op Hetzner | GREEN |
| UI | synthetische Task, status, artifact, evidence, zichtbare DENY; geen directe model/store-verbinding | GREEN |
| Datahygiëne | geen echte context/secrets/hosts in Git/CI/evidence; scan schoon | GREEN |
| End-to-end | synthetische shadow-run per adapter via fakes; live: één echte draft via Qwen + MCP-read over tailnet | GREEN |
| Git | schone `pilot/integration`; geen merge naar master | GREEN |

## Testaantallen

```text
TEST_COUNTS=builder 167 pass / 0 fail (lib/adr110 + adapters/** + pilot)
            tsc --noEmit (lib/adr110 + pilot) = 0 fouten
            eslint lib/adr110 pilot --max-warnings 0 = clean
PILOT_SPINE_RUN_URL=https://github.com/achmmadd/AI_HQ/actions/runs/31884376349
            (Pilot Spine #19 op pilot/integration @ 7b1620f: success)
HOLDING_CHECKS_RUN_URL=n/a — geen holding-checks in deze sprint
```

## Live smoke (apart gelabeld; vervangt geen CI-fakes)

```text
LIVE_MODEL_SMOKE=yes — POST /draft via tailnet → echt Qwen3.6-35B-A3B-concept
  (RTX-pc, llama-server systemd), demo-context "De Linde"
MCP live: initialize (protocol 2025-06-18), tools/list (1 tool, readOnlyHint),
  tools/call → gesanitiseerde snapshot van de live run (alleen digests),
  motor.pilot.publish → DENY unknown_tool
NUC_SMOKE=no — kiosk-launcher is klaar; NUC-node moet nog in PILOT_ACL
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
```

## Restrisico's

```text
RESIDUAL_RISKS=
- Hermes/AgentScope-sidecars zijn skeletons (501 not-wired); echte bedrading
  is een aparte expliciete taak met eigen gate.
- Transitive Python-deps van AgentScope niet hash-gelockt (pip-compile
  --generate-hashes vereist vóór live gebruik).
- MCP-SDK niet als dependency gepind (gedeelde lockfile); handler spreekt
  protocol 2025-06-18 met SDK-annotatievormen.
- Settlement v2 is bewust breaking binnen de gesloten pilot; oude
  v1-settlements worden afgewezen.
- At-most-once store: crash ná claim vóór append verliest de write
  (zichtbaar als 500), nooit dubbel.
- 4xx (niet-429) mapt op malformed_response in de Hermes-adapter omdat de
  fase-0-taxonomie geen rejected-code kent — vastgelegd, geen blokker.
```

## Eindstatus

```text
P0_CODE_GATE=GREEN (builder + CI Pilot Spine #19 success)
LIVE_AUTHORITY=NONE — live gebruik, echte context en mastermerge vereisen
een aparte expliciete eigenaarsautorisatie.
```
