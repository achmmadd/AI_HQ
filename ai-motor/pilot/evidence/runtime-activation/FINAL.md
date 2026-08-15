# FINAL — P0.6 runtime-activatie- en bewijsgate

> Coördinator: integratielijn op `pilot/runtime-activation`.
> Grenzen ongewijzigd: geen master-merge, geen echte context, geen publieke ingress, geen live-authority.

## SHA's en CI

```text
BASE_SHA=50dd65dbe1dd70bd5d58d86221b1e587b4d201d9
RUNTIME_INTEGRATION_SHA=57c4814d2e08221565a4c1d86888ac4e5e6aefc4
FINAL_EVIDENCE_SHA=2996cf03b7e3d2f22a4bd353c4f3e93245fc2423
TEST_COUNT=218 pass / 0 fail / 1 geregistreerde skip (conformance-modus zonder python in alpine-gate)
CI_URLS=<workflow-trigger via owner web-UI; zie onder>
```

Lane-SHA's:

```text
A hermes      345664792c1973602b71d39a91066dd58de00a93  (merge 83b96e6)
B agentscope  c76b0b5ee82e00b43013386aab4854c02d5e4188  (merge 725832b)
C security    ba292be17bed80a6490a7e9a933f0c2b305ef1a7  (via runtime-e-secfix)
D conformance fdc2b36                                   (merge d72c681)
E1/E2 fix     1b242281290093ab77cc4a5e5c01f3688a785758
guardfix      4d1bef0                                   (merge 57c4814)
```

## Bewijsclaims

```text
HERMES_WIRED=yes
HERMES_SYNTHETIC_SMOKE=yes              # container start + readiness + invoke-echo, builder-bewijs in LANE-A
HERMES_LIVE_SMOKE=not_authorized        # echte ModelPort/tailnet-egress vereist aparte eigenaarsautorisatie

AGENTSCOPE_WIRED=yes
AGENTSCOPE_SYNTHETIC_SMOKE=yes          # idem, LANE-B
AGENTSCOPE_LIVE_SMOKE=not_authorized
AGENTSCOPE_TRANSITIVE_HASH_LOCK=yes     # 90 packages / 1761 hashes, --require-hashes, LANE-B

FIVE_ADAPTER_CONFORMANCE=yes            # hermes+agentscope ECHT in gecombineerd builder-image: 181/181, --network none (LANE-D)
RUNTIME_FAILURE_EVIDENCE=yes            # timeout/cancel/unavailable/malformed → terminale state + causale evidence, per sidecar
RUNTIME_ISOLATION_TESTS=yes             # mount/env/tool-deny + compose-guards + source-guards (eigenschap-asserts, mutatie-bewezen)
MCP_DENY_REGRESSION=yes                 # incl. E1-fix: notifications nooit gedispatcht; E2-fix: workspace-tenancy in snapshot-provider
DECISION_LOOP_REGRESSION=yes            # boundary 6a/6c/6d/7c/7d/7e groen op finale SHA

REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
LIVE_AUTHORITY=NONE
```

## Security-uitkomst (spoor C + fixes)

- 37 negatieve tests; 8 van 10 aanvalspunten hielden direct stand.
- **E1 (MCP voerde notifications uit)** → gefixt in `pilot/mcp/server.ts` (geen dispatch zonder `id`); S9d groen.
- **E2 (cross-workspace run_id-lek)** → gefixt in `pilot/mcp/store-provider.ts` (workspace-filter vóór run_id-match, fail-closed voor records zonder tenancy); S9e/S9f groen.
- Lane-conflict (skeleton-guards vs. bedraade runtime) gereconcilieerd: guards dwingen nu eigenschappen af (geen tools/memory/volumes/secrets/eigen sockets), mutatie-bewezen.

## Builder-validatie finale SHA (57c4814)

```text
TESTS_EXIT=0   218 pass / 0 fail / 1 skipped (geregistreerde conformance-skip in alpine)
TYPES_EXIT=0
LINT_EXIT=0
```

## Restrisico's

1. De standaard `node:24-alpine`-gate dekt de sidecar-runtime niet (skip zichtbaar); het python-forziene gecombineerde image is nu handmatige tooling op de builder — aanbeveling: opnemen in de CI-gate.
2. Sidecar-egress naar de echte tailnet-ModelPort is bewust dicht (`internal: true`); live-smoke vereist aparte autorisatie én een netwerkwijziging.
3. Records zonder `workspace_id` (legacy) zijn fail-closed onzichtbaar via MCP; bij toekomstige tenancy in de store deze kolom verplicht stellen.
4. Guard-tests zijn statisch bewijs; ze gelden alleen zolang deze suite in de gate meedraait.
5. C-agent-observaties zonder escalatie (registry `default`-throw, niet-gefroren allowlist, exacte `req.url`-matching) staan in LANE-C-SECURITY.md — geen open gat, wel aandachtspunten.

## Niet gedaan (bewust)

Geen live model-smoke (not_authorized), geen compose-integratie in de draaiende pilot-stack op Hetzner (sidecars zijn eigen overlays), geen LICENSE, geen master-merge, geen governance-docs gewijzigd.
