# P0.8 — Live-activatie: sidecars + drie adapter-smokes

Datum: 2026-08-15 · Branch: `pilot/p08-live` · Basis: `fc37d90` (P0.8-prep merge op
`pilot/runtime-activation`, suite 225/0/1 groen).
Uitvoerder: Cursor-agent (P0.8 live-activatie) · Eigenaarsautorisatie: expliciet,
eenmalig, voor díe live-activatie (sidecars al additief gestart door de
coördinator; deze lane maakt health, API-env, drie synthetische adapter-smokes
en evidence af). Alle overige grenzen bleven staan: geen echte bedrijfscontext,
geen publieke ingress, geen store-recreate, geen master-merge, geen
governance-docs.

## Checkpoint

```text
BASE_SHA=fc37d90  (origin/pilot/runtime-activation bij lane-start;
                  merge origin/pilot/p08-integratie)
WERKBOOM=/tmp/aihq-p08-live  (git worktree op pilot/p08-live)
LIVE=/opt/motor-pilot op Hetzner (compose.yaml + hermes/agentscope-overlays)
REPO_MOUNT=/opt/motor-pilot/repo @ fc37d90
MODELPORT=http://100.118.204.123:8080  (Qwen op RTX, tailnet; /health ok)
```

Eigen paden (enige schrijver deze lane):

- `ai-motor/pilot/evidence/runtime-activation/P08-LIVE.md` — dit bestand

Niet aangeraakt: adapter-/sidecar-sources, compose-overlays, registry, store,
governance-docs, master. Op Hetzner alleen `.env`-keys toegevoegd
(`PILOT_ADAPTER`, `HERMES_SIDECAR_URL`, `AGENTSCOPE_SIDECAR_URL`) en de
API-container herhaald `--no-deps --force-recreate`. Store-container
onaangeroerd.

## Stap 1 — Diagnose (onderbroken health-check van de coördinator)

De sidecars waren al ~12 minuten Up/healthy toen deze lane begon. Geen
herstart nodig.

```text
motor-pilot-agentscope-hermes-sidecar-1      Up ~12 min (healthy)
motor-pilot-agentscope-agentscope-sidecar-1  Up ~12 min (healthy)
motor-pilot-motor-pilot-api-1                Up 26 h   (pre-recreate)
motor-pilot-motor-pilot-store-1              Up 26 h

hermes inspect:    running healthy  172.26.0.2 (hermes-net)  172.27.0.3 (pilot-egress)
agentscope inspect: running healthy  172.27.0.2 / 172.28.0.2
beide logs: herhaalde GET /health 200 (docker healthcheck)
```

Netwerkvorm zoals P0.8-ontwerp: eiland `motor-pilot-agentscope_hermes-net`
+ `pilot-egress` op de hermes-sidecar. Hermes publiceert geen poort.

## Stap 2 — Sidecar-health (korte timeouts)

```text
GET http://172.26.0.2:4410/health     → HTTP 200
  {"protocol":"motor-sidecar/1","status":"ok","detail":"ok"}
GET http://127.0.0.1:4410/health      → HTTP 200
  {"protocol":"motor-sidecar/1","status":"ok",
   "checks":{"model_loop":"alive","model_endpoint":"reachable"}}
```

Beide 200 + protocol `motor-sidecar/1`. Geen hang (curl `-m 5`).

## Stap 3 — API-env en recreate (store ongemoeid)

Ontbrekende keys in `/opt/motor-pilot/.env` (waarden niet herhaald):

```text
ADD PILOT_ADAPTER=llamacpp
ADD HERMES_SIDECAR_URL=http://<hermes-net-IP>:4410
ADD AGENTSCOPE_SIDECAR_URL=http://127.0.0.1:4410
```

`PILOT_ACL` was al aanwezig. De Hetzner-host (`Motor2`) zit **niet** in de
ACL (`host_in_acl=false`); de builder-MacBook wel (WhoIs-StableID-match).
Smokes daarom vanaf de MacBook, dezelfde Tailscale-identiteit als eerdere
live-smokes. ACL-inhoud niet getoond.

```text
STORE BEFORE  started=2026-08-14T12:43:26.281657664Z  pid=2830046
API  BEFORE   started=2026-08-14T12:43:26.875489356Z

docker compose -f compose.yaml up -d --no-deps --force-recreate motor-pilot-api
  Container motor-pilot-motor-pilot-api-1 Recreated / Started

STORE AFTER   started=2026-08-14T12:43:26.281657664Z  pid=2830046  (ongewijzigd)
API  AFTER    started=2026-08-15T15:11:58Z  (nieuw)
API log       motor-pilot API luistert op <tailnet>:4400 (adapter: llamacpp)
GET /health   HTTP 200  {"ok":true,"model":true}
GET /drafts   HTTP 200  ok=true (MacBook-ACL)
```

Iedere latere adapter-flip gebruikte hetzelfde commando. Store-started en
store-pid bleven `2026-08-14T12:43:26.281657664Z` / `2830046` bij alle vijf
API-recreates (llamacpp → hermes → llamacpp → agentscope → llamacpp).

## Stap 4 — Drie synthetische adapter-smokes

Vaste input: de bestaande `SYNTHETIC_REVIEW` (fictieve B&B De Linde,
4 sterren, ontbijt + geluidsoverlast). Geen `context`-veld in de request
(CONTEXT_MODE=demo). Content-Type `application/json`. Geen echte
bedrijfsdata. Publish-probe per run DENY.

| Adapter | HTTP | ok | latency_ms | elapsed_ms | adapter_id | draft | chainValid | orphans | store | publish |
|---|---|---|---|---|---|---|---|---|---|---|
| llamacpp (default) | 200 | true | 2542 | 2642 | `llamacpp-server` | 1132 tekens, niet-leeg | true | 0 | stored | DENY |
| hermes | 200 | true | 2441 | 2550 | `hermes` | 1163 tekens, niet-leeg | true | 0 | stored | DENY |
| agentscope | 200 | true | 3346 | 3488 | `agentscope` | 1123 tekens, niet-leeg | true | 0 | stored | DENY |

Elke sidecar-flip: `PILOT_ADAPTER=<id>` in `.env`, daarna alleen
`docker compose -f compose.yaml up -d --no-deps --force-recreate motor-pilot-api`.
Na hermes teruggezet naar llamacpp; na agentscope opnieuw teruggezet naar
llamacpp. Eindstaat: API luistert met `adapter: llamacpp`. Sidecars blijven
Up/healthy; hermes- en agentscope-health opnieuw 200 + `motor-sidecar/1`.

```text
kernelTaskStatus=completed   contextSource=demo   health=ok
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no          (alleen inference naar lokale ModelPort; publish DENY)
PUBLIC_INGRESS=no
STORE_RECREATED=no
MASTER_MERGE=no
```

## Bewijsclaims

| Claim | Waarde | Bewijs |
|---|---|---|
| SIDECARS_HEALTHY | **yes** | Stap 1–2: beide Up/healthy; /health 200 + `motor-sidecar/1` |
| LLAMACPP_SMOKE | **yes** | Stap 4: 200, niet-lege draft, chainValid, adapter `llamacpp-server`, 2542 ms |
| HERMES_SMOKE | **yes** | Stap 4: 200, niet-lege draft, chainValid, adapter `hermes`, 2441 ms |
| AGENTSCOPE_SMOKE | **yes** | Stap 4: 200, niet-lege draft, chainValid, adapter `agentscope`, 3346 ms |
| STORE_UPTIME_UNCHANGED | **yes** | zelfde StartedAt + pid over alle API-recreates |
| API_DEFAULT_RESTORED | **yes** | eindlog `adapter: llamacpp` |
| REAL_CONTEXT_USED | no | synthetische De Linde / CONTEXT_MODE=demo |
| EXTERNAL_EFFECTS | no | publish-probe DENY; geen extra listeners/poorten |
| PUBLIC_INGRESS | no | API blijft tailnet-bind; hermes geen published port |
| MASTER_MERGE | no | alleen branch `pilot/p08-live` |

## Restrisico's

1. **Hermes-container-IP is niet stabiel** over recreates (P0.8-integratie #1).
   `HERMES_SIDECAR_URL` wijst nu naar `172.26.0.2`. Een sidecar-recreate
   vereist herbepaling van die URL en een API-recreate.
2. **Hetzner-host zit niet in `PILOT_ACL`.** Live reads/writes vanaf de
   builder-host zelf krijgen 403 `node_not_allowed`. Smokes liepen via de
   MacBook-identiteit die wél in de ACL staat. Toevoegen van Motor2 is een
   aparte ACL-wijziging, niet in deze lane gedaan.
3. **`pilot-egress` is een algemene bridge** (P0.8-integratie #2): egress is
   niet fijnmazig beperkt tot het ModelPort-IP. Host-firewall blijft
   operatorhandeling.
4. **Legacy-demo-records zonder `workspace_id`** blijven onzichtbaar in
   `/drafts` (bedoeld, P0.8-tenancy). Nieuwe writes van deze lane dragen
   `ws-motor`.
5. **Smoke-dekking is happy-path.** Timeout/cancel/malformed tegen het echte
   model zijn niet live herhaald; dat gedrag blijft fake-gedekt in de suite.
6. **Vijf API-recreates** in deze lane (env-load + twee flips + twee
   resets). Elk `--no-deps --force-recreate` van alleen `motor-pilot-api`;
   store-pid ongewijzigd. Een volgende lane moet die discipline herhalen.

```text
SIDECARS_HEALTHY=yes
LLAMACPP_SMOKE=yes
HERMES_SMOKE=yes
AGENTSCOPE_SMOKE=yes
STORE_UPTIME_UNCHANGED=yes
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
PUSHED=yes (branch pilot/p08-live, geen merge)
```
