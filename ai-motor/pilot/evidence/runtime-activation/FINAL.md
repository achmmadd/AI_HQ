# FINAL — P0 runtime-activatie (P0.6–P0.9)

> Coördinator: integratielijn op `pilot/runtime-activation`.
> Grenzen ongewijzigd: geen master-merge, geen echte bedrijfscontext, geen
> publieke ingress, geen live-authority. Repo is publiek.

## SHA's en CI

```text
BASE_SHA=50dd65dbe1dd70bd5d58d86221b1e587b4d201d9
RUNTIME_INTEGRATION_SHA=e53f18bf7b5d4aa3fd3f3e5b5eaee9c12a8a4434
FINAL_EVIDENCE_SHA=PENDING
TEST_COUNT=225 pass / 0 fail / 1 geregistreerde skip (conformance-modus zonder python in alpine-gate)
CI_URLS=https://github.com/achmmadd/AI_HQ/actions/runs/31888935247 (success, 547fb41) + Pilot Spine #23 (success, cc95d1d — incl. pilot/security-glob: volledige 218-test gate in CI). P0.7 python-conformance-job is nog owner-edit: yaml-blok in P07-LIVE-SMOKE.md, plakken via GitHub web-UI in .github/workflows/pilot-spine.yml op deze branch — niet door CI bewezen.
```

Lane-SHA's:

```text
A hermes         345664792c1973602b71d39a91066dd58de00a93  (merge 83b96e6)
B agentscope     c76b0b5ee82e00b43013386aab4854c02d5e4188  (merge 725832b)
C security       ba292be17bed80a6490a7e9a933f0c2b305ef1a7  (via runtime-e-secfix)
D conformance    fdc2b3645770d49f20518264b606ea4c832b2ccd  (merge d72c681)
E1/E2 fix        1b242281290093ab77cc4a5e5c01f3688a785758
guardfix         4d1bef0e4ad35a44c5fe5960bce08ab009fd8184  (merge 57c4814)
P07 live-smoke   d9dd1e01c6b98b9d91a00eab8088cfb3a6d17322  (fix 115e1f2, merge 9d00c08)
P08 integratie   9b89ac6b3743f75d5f030fac6ba10004db1b012c  (merge fc37d90)
P08 live         d54239cb216539c9c60fdda7e91bedcafb526dc0  (merge 5264462)
P09 private      a0b5196fdfc9a8db97f12dbbe66caa134c5fb73f  (merge e53f18b)
```

## Bewijsclaims

```text
HERMES_WIRED=yes
HERMES_SYNTHETIC_SMOKE=yes              # container start + readiness + invoke-echo, builder-bewijs in LANE-A
HERMES_LIVE_SMOKE=yes                   # P0.7: echte ModelPort via one-shot sidecar + Node-adapter-wire

AGENTSCOPE_WIRED=yes
AGENTSCOPE_SYNTHETIC_SMOKE=yes          # idem, LANE-B
AGENTSCOPE_LIVE_SMOKE=yes               # P0.7: echte ModelPort via one-shot sidecar + Node-adapter-wire
AGENTSCOPE_TRANSITIVE_HASH_LOCK=yes     # 90 packages / 1761 hashes, --require-hashes, LANE-B

FIVE_ADAPTER_CONFORMANCE=yes            # hermes+agentscope ECHT in gecombineerd builder-image: 181/181, --network none (LANE-D); P0.7: 219/219/0 skip gecombineerd
RUNTIME_FAILURE_EVIDENCE=yes            # timeout/cancel/unavailable/malformed → terminale state + causale evidence, per sidecar
RUNTIME_ISOLATION_TESTS=yes             # mount/env/tool-deny + compose-guards + source-guards (eigenschap-asserts, mutatie-bewezen)
MCP_DENY_REGRESSION=yes                 # incl. E1-fix: notifications nooit gedispatcht; E2-fix: workspace-tenancy in snapshot-provider
DECISION_LOOP_REGRESSION=yes            # boundary 6a/6c/6d/7c/7d/7e groen op finale SHA

STORE_TENANCY=yes                       # P0.8: workspace_id verplicht, fail-closed list/filter, MCP defense-in-depth
COMPOSE_SIDECARS_LIVE=yes               # P0.8-live: beide sidecars Up/healthy, /health 200 + motor-sidecar/1
THREE_ADAPTER_E2E=yes                   # P0.8-live: llamacpp + hermes + agentscope synthetische /draft, chainValid, publish DENY

CONTEXT_MODE_PRIVATE_FAIL_CLOSED=yes    # P0.9: private zonder bestand → 500 context_unavailable_private_mode, geen demo-fallback
CONTEXT_MODE_PRIVATE_SYNTHETIC_OK=yes   # P0.9: synthetisch volume → contextSource=volume, draft gebruikt fictieve feiten
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
LIVE_AUTHORITY=NONE
P0_COMPLETE=yes
P1_READY=yes                            # product-shell/koppelingen ná expliciete eigenaarsopdracht; zie P1-READY.md
```

## Security-uitkomst (spoor C + fixes) — P0.6, ongewijzigd geldig

- 37 negatieve tests; 8 van 10 aanvalspunten hielden direct stand.
- **E1 (MCP voerde notifications uit)** → gefixt in `pilot/mcp/server.ts` (geen dispatch zonder `id`); S9d groen.
- **E2 (cross-workspace run_id-lek)** → gefixt in `pilot/mcp/store-provider.ts` (workspace-filter vóór run_id-match, fail-closed voor records zonder tenancy); S9e/S9f groen.
- Lane-conflict (skeleton-guards vs. bedraade runtime) gereconcilieerd: guards dwingen nu eigenschappen af (geen tools/memory/volumes/secrets/eigen sockets), mutatie-bewezen.
- P0.8 maakte `workspace_id` verplicht in de store (restrisico #3 uit P0.6); legacy-records zonder kolom blijven fail-closed onzichtbaar.

## Builder-validatie RUNTIME_INTEGRATION_SHA (e53f18b)

Onafhankelijke clone in `/tmp/pv-close` op Hetzner, `node:24-alpine`:

```text
CLONE_SHA=e53f18bf7b5d4aa3fd3f3e5b5eaee9c12a8a4434
TESTS_EXIT=0   ℹ pass 225  ℹ fail 0  ℹ skipped 1
TYPES_EXIT=0   (tsc --noEmit -p pilot/tsconfig.json)
LINT_EXIT=0    (eslint lib/adr110 pilot --max-warnings 0)
```

De skip is de geregistreerde conformance-modustest zonder python in alpine
(ongewijzigd t.o.v. P0.7–P0.9). Testdelta t.o.v. P0.6 (218): +7 = tenancy/store
+ compose-guards (P0.8). Evidence-only commits na deze SHA wijzigen de suite niet.

## Restrisico's (geconsolideerd P07 + P08 + P09)

1. **CI python-conformance-job is owner-edit.** Het yaml-blok staat in
   P07-LIVE-SMOKE.md; recept handmatig groen (219/219, beide modi real), maar
   niet via GitHub-runner bewezen. Alpine-gate skip 1 blijft zichtbaar tot die
   job erin staat. Eerste echte CI-run na plakken is het definitieve bewijs.
2. **Hetzner-host zit niet in `PILOT_ACL`.** Live reads/writes vanaf de
   builder krijgen 403 `node_not_allowed`. P0.8/P0.9-smokes liepen via de
   MacBook-identiteit. Motor2 toevoegen is een aparte ACL-wijziging.
3. **Hermes-container-IP is niet stabiel** over sidecar-recreates.
   `HERMES_SIDECAR_URL` moet dan opnieuw bepaald plus API-recreate. Geen
   loopback-publish gekozen (geen extra host-poort voor hermes).
4. **`pilot-egress` is een algemene bridge**; egress is niet fijnmazig
   beperkt tot het ModelPort-IP. Host-firewall (ufw/iptables) blijft
   operatorhandeling. P0.7-smokes gebruikten `--network host` one-shots
   (containers verwijderd); de compose-overlay (`internal: true` eiland)
   is ongemoeid.
5. **Live-dekking is happy-path.** Timeout/cancel/malformed tegen het echte
   model zijn niet live herhaald (fake-gedekt in de suite). Leeg-bestand in
   private mode (`context_empty_private_mode`) is unit-gedekt, niet live.
6. **`enable_thinking` staat vast op false** in beide sidecars (fase-0 eist
   niet-lege `content`). Asymmetrie met de llamacpp-adapteroptie; aanzetten
   is een bewuste codewijziging.
7. **Private fail-closed is HTTP 500** (`resolveContext` gooit; API-catch
   geeft de bestaande errorcategorie door). Functioneel correct, geen
   demo-fallback; operators die 4xx verwachten zien 500. Geen codesemantiek
   in P0.9 gewijzigd.
8. **Volume-schrijven vereist een RW-helper** (API-mount `:ro`, uid 1000).
   Self-serve-commando's staan in P09-PRIVATE.md; verkeerde uid ziet eruit
   als fail-closed.
9. **Legacy-records zonder `workspace_id`** blijven onzichtbaar (bedoeld).
   Eén synthetische P0.9-draft zit in de store onder `ws-motor`; geen echte
   bedrijfsinhoud. Store-container is nooit gerecreëerd.
10. **Model-id is een pad** (`/home/motorai/models/….gguf`) via `/v1/models`
    naar elke tailnet-client — bekend llama.cpp-gedrag, geen nieuwe
    blootstelling. Guard-tests blijven statisch bewijs zolang de suite in de
    gate meedraait.

## Niet gedaan (bewust)

Geen echte bedrijfscontext, geen publieke ingress, geen master-merge, geen
governance-docs, geen LICENSE, geen live-authority, geen CI-workflow-write
(owner-edit). P1 start pas na een aparte expliciete eigenaarsopdracht; zie
`P1-READY.md`.
