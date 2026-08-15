# P0.9 — CONTEXT_MODE=private gate (synthetische context)

Datum: 2026-08-15 · Branch: `pilot/p09-private` · Basis: `5264462`
(P0.8-live gemergd in `pilot/runtime-activation`, suite 225/0/1 groen).
Uitvoerder: Cursor-agent (P0.8-integratie + P0.9) · Eigenaarsautorisatie:
expliciet, eenmalig, voor díe merge én díe private-context-gate. Alle
overige grenzen bleven staan: geen echte bedrijfscontext, geen publieke
ingress, geen store-recreate, geen master-merge, geen governance-docs.

```text
CONTEXT_MODE_PRIVATE_FAIL_CLOSED=yes
CONTEXT_MODE_PRIVATE_SYNTHETIC_OK=yes
BODY_CONTEXT_REJECTED=yes
REAL_CONTEXT_USED=no
STORE_UNTOUCHED=yes
SELF_SERVE_COMMANDS=yes
```

## Checkpoint

```text
MERGE_SHA=526446212d252b92a53e3a22b7aa96815ac1255a
  (origin/pilot/p08-live --no-ff in origin/pilot/runtime-activation)
WERKBOOM=/tmp/aihq-p09  (git worktree op pilot/p09-private)
LIVE=/opt/motor-pilot op Hetzner (compose.yaml; sidecars ongemoeid)
VOLUME=motor-pilot_pilot-context  gemount /context:ro in de API
CONTEXT_FILE=/context/ondernemer-context.txt  (default; niet gewijzigd)
ADAPTER=llamacpp  (ongewijzigd; default hersteld na afloop)
```

Eigen pad (enige schrijver deze lane):

- `ai-motor/pilot/evidence/runtime-activation/P09-PRIVATE.md` — dit bestand

Niet aangeraakt: adapter-/sidecar-sources, compose, registry, store-container,
governance-docs, master. Op Hetzner alleen `CONTEXT_MODE` in `.env` omgezet
(private → demo terug) en de API-container herhaald
`--no-deps --force-recreate`. Store-container onaangeroerd. Het
synthetische contextbestand stond alleen runtime op het volume en is na de
smoke verwijderd; het is **niet** gecommit.

## Suite (bestaande tests, geen codesemantiek gewijzigd)

Unit-dekking bleef groen op de merge-SHA (builder `/tmp/pv-int3`) en wordt
na deze evidence-commit herhaald in `/tmp/pv-p09`:

| Test | Wat hij bewijst |
|---|---|
| `3a` | `CONTEXT_MODE=demo` leest nooit het privé-volume |
| `3b` | `private` leest het volume; ontbrekend/leeg bestand → expliciete fout, geen demo-fallback |
| `3c` | `body.context` → 400 `context_via_request_not_allowed`; niet-JSON → 415 |
| `7a` | ongeldige `CONTEXT_MODE` faalt gesloten; leeg/ontbrekend = gedocumenteerde demo |

Errorcategorieën ongewijzigd: `context_unavailable_private_mode`,
`context_empty_private_mode`, `context_mode_invalid`,
`context_via_request_not_allowed`.

## Stap 1 — Fail-closed zonder volume-bestand

Beginstaat: `CONTEXT_MODE=demo`, volume leeg (`FILE_EXISTS=no`), adapter
`llamacpp`. Hetzner-host zit **niet** in `PILOT_ACL`; POST's vanaf deze
MacBook (tailnet-identiteit die wél in de ACL staat). ACL-inhoud niet
getoond. Geen IPs in dit document.

```text
STORE BEFORE  started=2026-08-14T12:43:26.281657664Z  pid=2830046
API  BEFORE   started=2026-08-15T15:13:31Z

.env: CONTEXT_MODE=demo → private
docker compose -f compose.yaml up -d --no-deps --force-recreate motor-pilot-api
  Container motor-pilot-motor-pilot-api-1 Recreated / Started

STORE AFTER   started=2026-08-14T12:43:26.281657664Z  pid=2830046  (ongewijzigd)
API env       CONTEXT_MODE=private  PILOT_ADAPTER=llamacpp
API log       luistert op <tailnet>:4400 (adapter: llamacpp)
FILE_EXISTS   no
```

POST `/draft` (synthetische `SYNTHETIC_REVIEW`, geen `context`-veld,
`Content-Type: application/json`):

```text
HTTP=500
{"ok":false,"error":"context_unavailable_private_mode"}
contextSource=(afwezig)
draft=(afwezig)
evidence=(afwezig)
bevat "De Linde"=no
```

Geen fallback naar `DEFAULT_CONTEXT` / demo. De bestaande errorcategorie
is de hele body; er is geen draft en geen evidence-keten.

## Stap 2 — Private-mode met synthetisch bestand

Runtime-only, uid 1000, volume `motor-pilot_pilot-context`. Inhoud: een
**fictieve** testhoreca (Pension De Wilgenhof) plus een unieke
synthese-markering. Geen echte namen, klanten, reviews of PII. Bestand
nooit gecommit. Tekst hier niet herhaald.

Daarna opnieuw alleen de API recreaten (`CONTEXT_MODE` bleef `private`).
Store-pid ongewijzigd.

POST `/draft` dezelfde synthetische review:

```text
HTTP=200  time≈2.65s
ok=true
contextSource=volume          (niet demo)
draft_len=1170                (niet-leeg)
kernelTaskStatus=completed
chainValid=true  orphans=0
adapter ongewijzigd (llamacpp)

draft bevat unieke synthetische feiten (Wilgenhof, tuinkamer)=yes
draft bevat demo-feiten (De Linde, dubbel glas, gemeente)=no
evidence (7 records) bevat contexttekst / markering / De Linde=no
```

Daarna: bestand verwijderd (`FILE_EXISTS=no`), API opnieuw recreaten
(nog steeds `private`), POST `/draft`:

```text
HTTP=500
{"ok":false,"error":"context_unavailable_private_mode"}
```

Opnieuw fail-closed; geen stille terugval naar demo.

## Stap 3 — ACL / `body.context` in beide modes

POST met extra sleutel `"context":"INJECT-SHOULD-FAIL"` (zelfde review,
`application/json`). Injectietekst kwam nergens in een response terug.

| Mode | Bestand | HTTP | error |
|---|---|---|---|
| private | nee | 400 | `context_via_request_not_allowed` |
| private | synthetisch ja | 400 | `context_via_request_not_allowed` |
| demo (hersteld) | nee | 400 | `context_via_request_not_allowed` |

Weigering gebeurt vóór contextresolutie: in private-zonder-bestand is het
400 (niet 500). Demo-mode weigert evenzeer; de browser kan geen context
injecteren.

## Stap 4 — Terug naar demo

```text
.env: CONTEXT_MODE=private → demo
docker compose -f compose.yaml up -d --no-deps --force-recreate motor-pilot-api
STORE FINAL   started=2026-08-14T12:43:26.281657664Z  pid=2830046  (ongewijzigd)
API env       CONTEXT_MODE=demo  PILOT_ADAPTER=llamacpp
FILE_EXISTS   no
GET /health   HTTP 200  {"ok":true,"model":true}
GET /drafts   HTTP 200  ok=true  (MacBook-ACL)
```

Vier API-recreates in deze lane; store-StartedAt en store-pid identiek aan
P0.8. Synthetisch volume-bestand weg. Adapter bleef `llamacpp`.

## Self-serve commando's (echte context later, zonder codewijziging)

De eigenaar vult later zelf kennis. Geen voorbeeld met echte data. Het
pad is vast: `/context/ondernemer-context.txt` op volume
`motor-pilot_pilot-context`. De API mount dat volume **read-only**; schrijven
gaat via een tijdelijke helper. Store niet aanraken.

```bash
# 1. Lokaal bestand klaarzetten (plaintext, NOOIT committen / pushen).
#    Inhoud: jouw ondernemerscontext. Geen PII die niet in de prompt mag.

# 2. Schrijf naar het volume (RW-helper, uid 1000 = API-user):
ssh hetzner 'docker run --rm -i --user 1000:1000 \
  -v motor-pilot_pilot-context:/context alpine \
  sh -c "cat > /context/ondernemer-context.txt"' < ./jouw-context.txt

# 3. Controleer dat het bestand er is (geen inhoud dumpen in logs/tickets):
ssh hetzner 'docker run --rm --user 1000:1000 \
  -v motor-pilot_pilot-context:/context:ro alpine \
  sh -c "test -s /context/ondernemer-context.txt && echo FILE_OK=yes || echo FILE_OK=no"'

# 4. Zet private mode in /opt/motor-pilot/.env (alleen deze regel):
#      CONTEXT_MODE=private
ssh hetzner 'cd /opt/motor-pilot && sed -i "s/^CONTEXT_MODE=.*/CONTEXT_MODE=private/" .env'

# 5. Recreate ALLEEN de API (geen store, geen sidecars):
ssh hetzner 'cd /opt/motor-pilot && docker compose -f compose.yaml \
  up -d --no-deps --force-recreate motor-pilot-api'

# 6. POST /draft vanaf een identiteit die in PILOT_ACL staat
#    (Hetzner-host zelf zit daar niet in). Geen "context"-sleutel in de body.

# Terug naar demo (bestand mag blijven staan; demo leest het nooit):
#   CONTEXT_MODE=demo  + dezelfde API-recreate.
# Bestand verwijderen (optioneel; private zonder bestand faalt expliciet):
#   docker run --rm --user 1000:1000 -v motor-pilot_pilot-context:/context alpine \
#     rm -f /context/ondernemer-context.txt
```

Als het bestand ontbreekt of leeg is terwijl `CONTEXT_MODE=private`, faalt
`POST /draft` met `context_unavailable_private_mode` of
`context_empty_private_mode`. Dat is bedoeld. Zet `CONTEXT_MODE=demo` terug
vóór je het bestand weghaalt als de API bruikbaar moet blijven.

## Bewijsclaims

| Claim | Waarde | Bewijs |
|---|---|---|
| CONTEXT_MODE_PRIVATE_FAIL_CLOSED | **yes** | Stap 1 en na Stap 2: HTTP 500, `context_unavailable_private_mode`, geen De Linde |
| CONTEXT_MODE_PRIVATE_SYNTHETIC_OK | **yes** | Stap 2: HTTP 200, `contextSource=volume`, draft gebruikt synthetische feiten, evidence zonder contexttekst |
| BODY_CONTEXT_REJECTED | **yes** | Stap 3: 400 in private (met/zonder bestand) én in demo |
| REAL_CONTEXT_USED | **no** | alleen fictieve Wilgenhof-synthese + bestaande `SYNTHETIC_REVIEW` |
| STORE_UNTOUCHED | **yes** | zelfde StartedAt + pid over alle API-recreates |
| SELF_SERVE_COMMANDS | **yes** | sectie hierboven; geen echte data in het voorbeeld |
| API_DEFAULT_RESTORED | **yes** | eindstaat `CONTEXT_MODE=demo`, adapter `llamacpp` |
| PUBLIC_INGRESS | no | API blijft tailnet-bind |
| MASTER_MERGE | no | alleen branch `pilot/p09-private` |

## Restrisico's

1. **Hetzner-host zit niet in `PILOT_ACL`.** Live reads/writes vanaf de
   builder-host zelf krijgen 403 `node_not_allowed`. Deze gate liep via de
   MacBook-identiteit. Motor2 toevoegen is een aparte ACL-wijziging.
2. **Fail-closed is HTTP 500**, omdat `resolveContext` gooit en de
   API-catch de bestaande errorcategorie doorgeeft. Functioneel correct
   (geen fallback); operators die een 4xx verwachten zien nu 500. Geen
   codesemantiek in deze lane gewijzigd.
3. **Volume-schrijven vereist een RW-helper.** De API-mount is `:ro`; een
   fout-uid (niet 1000) maakt het bestand onleesbaar voor de API en ziet er
   dan uit als fail-closed. Self-serve gebruikt daarom `--user 1000:1000`.
4. **Eén synthetische draft is in de store beland** (geslaagde private
   POST). De store-*container* is niet gerecreëerd; het record is
   `synthetic` onder `ws-motor`. Geen echte bedrijfsinhoud.
5. **Happy-path.** Leeg-bestand (`context_empty_private_mode`) is
   unit-gedekt (3b), niet live herhaald. Timeout/malformed tegen het model
   niet live herhaald.
6. **Hermes-container-IP blijft instabiel** over sidecar-recreates (P0.8).
   Deze lane raakte sidecars niet; default adapter bleef `llamacpp`.

## Validatie (eigen dir op Hetzner)

Onafhankelijke clone van `pilot/p09-private` in `/tmp/pv-p09`, daarna
`node:24-alpine` met dezelfde gate als P0.8 (in te vullen na push):

```text
SHA=(deze commit)
TESTS_EXIT=?   ℹ pass ?  ℹ fail ?  ℹ skipped ?
TYPES_EXIT=?
LINT_EXIT=?
```

```text
CONTEXT_MODE_PRIVATE_FAIL_CLOSED=yes
CONTEXT_MODE_PRIVATE_SYNTHETIC_OK=yes
BODY_CONTEXT_REJECTED=yes
REAL_CONTEXT_USED=no
STORE_UNTOUCHED=yes
SELF_SERVE_COMMANDS=yes
API_RESTORED_DEMO=yes
ADAPTER=llamacpp
PUBLIC_INGRESS=no
MASTER_MERGE=no
```
