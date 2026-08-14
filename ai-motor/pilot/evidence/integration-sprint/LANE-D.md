# LANE-D — read-only MCP-pad + NUC-testconsole (evidence)

> **Datum:** 2026-08-14 · **Uitvoerder:** coördinator (lane-agent crashte; spoor in de foreground gebouwd)
> **Branch:** `pilot/integration-d-mcp-nuc` · **Basis:** `65185e2` (fase-0 seam)

## Checkpoint

```text
BASE_SHA=e3558c5be3bc5aec557c5ffdaf779eff61df6c54  (origin/pilot/spine)
START_SHA=65185e23fdc6c5879eafc839478f98acb926ad13 (seam)
EIND_SHA=<zie git log van de branch; laatste commit op push>
```

## SDK-pin

**Geen SDK-dependency toegevoegd.** `package.json`/`package-lock.json` zijn
gedeelde sprint-surface buiten lane-scope; een nieuwe dependency zou de
lockfile van andere lanes raken. De handler spreekt het MCP-tooloppervlak
(initialize / tools/list / tools/call, JSON-RPC 2.0) en gebruikt het
SDK-annotatieschema (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`) als client-hints. **Protocoltarget: `@modelcontextprotocol/sdk`
protocolversie `2025-06-18`.** De daadwerkelijke SDK-pin (als de officiële
SDK later wordt ingebracht) is een integratiebeslissing van de coördinator.

## Authoritypad (zoals gebouwd)

```text
MCP request (JSON-RPC 2.0)
  → exact schema + allowlist (1 tool, 3 keys, additionalProperties:false)
  → workspace-scope (alleen ws-motor; cross-workspace = DENY)
  → policy-evaluatie (lane-eigen policy: alleen run.snapshot.read, R0)
  → Gateway evaluate → mint → execute (receipt vereist)
  → geïnjecteerde read-only driver (1 getter, geen write-surface)
  → sanitizer (ids/digests/status/chain-metadata; context/draft nooit)
  → snapshot + verse evidenceketen per read (5 records, unieke IDs)
```

## Bestanden

```text
ai-motor/pilot/mcp/snapshot.ts     (nieuw — scope, provider-contract, sanitizer)
ai-motor/pilot/mcp/policy.ts       (nieuw — lane-policy: alleen run.snapshot.read)
ai-motor/pilot/mcp/server.ts       (nieuw — JSON-RPC/MCP-handler, default-deny)
ai-motor/pilot/mcp.test.ts         (nieuw — 12 tests D1..D12)
ai-motor/infra/pilot/nuc/README.md (nieuw — kiosktopologie)
ai-motor/infra/pilot/nuc/motor-pilot-kiosk.sh (nieuw — launcher, alleen placeholders)
ai-motor/pilot/tsconfig.json       (include *.ts → **/*.ts zodat pilot/mcp meekomt)
ai-motor/pilot/evidence/integration-sprint/LANE-D.md (dit bestand)
```

Geen legacy-imports; `scripts/motors-http-mcp.mjs` is bewust niet gewrapt.

## Testaantallen (builder, Hetzner, node:24-alpine)

```text
node --test lib/adr110/*.test.ts pilot/*.test.ts   TESTS_EXIT=0  (pass 96 / fail 0)
tsc --noEmit -p pilot/tsconfig.json                TYPES_EXIT=0
eslint lib/adr110 pilot --max-warnings 0           LINT_EXIT=0
```

D1..D12 dekken: geldige read, onbekende tool, extra/ongeldige argumenten,
cross-workspace, write/publish/mail/payment/device-control, ontbrekende
scope, content-lekkage (markers op context/draft/host komen nooit in de
response; alleen geallowliste velden), duplicate-read met verse
evidence-ID's, read-only driver-contract, SDK-annotatie + Motor-enforcement,
initialize/unknown-method/garbage, en not-found-pad.

## NUC-console

Kiosk-launcher + README onder `infra/pilot/nuc/`: browser-only, direct naar
de Hetzner tailnet-origin (WhoIs ziet de echte NUC-node), geen proxy, geen
data, geen credentials, alleen placeholders. Lokaal hosten op de NUC is
bewust NIET gebouwd (vereist apart expliciet-originontwerp).

## Restrisico's

- De MCP-handler is nog niet in `pilot/server.ts` gewireerd — dat is een
  coördinator-integratiestap (server is gedeelde surface).
- De handler is getest als pure functie; geen live MCP-client aangesloten.
- SDK-pin uitgesteld (zie hierboven); bij invoeren van de echte SDK moeten
  de descriptor-vormen 1-op-1 gemapt worden.

## Verklaringen

```text
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
LIVE_MODEL_SMOKE=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
PUSHED=yes (branch pilot/integration-d-mcp-nuc, geen merge)
```
