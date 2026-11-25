# Nextcloud Taken-sync (GitHub Actions)

Werkstroom `.github/workflows/nextcloud-taken-sync.yml` schrijft branch, PR-URL, CI-status en (indien bekend) deploy-status terug naar Nextcloud Tables-tabel **Taken** (id 3) op `https://cloud.motorsai.app`. De job faalt **nooit** de PR: ontbrekende taak-id, fork-PR of API-fout wordt gelogd en eindigt met exit 0.

Dit is geen Motor-runtimecomponent. Geen app-, compose-, tunnel- of deploy-config wijzigen voor deze sync.

## Wat de eigenaar moet zetten

Geen waarden in git. Alleen namen:

| Type | Naam | Rol |
|---|---|---|
| Repository **secret** | `NEXTCLOUD_USER` | Nextcloud-gebruiker voor Basic auth |
| Repository **secret** | `NEXTCLOUD_APP_PASSWORD` | App-wachtwoord van die gebruiker |
| Repository **variable** | `NEXTCLOUD_URL` | Optioneel. Default: `https://cloud.motorsai.app` |
| Repository **variable** | `NEXTCLOUD_TAKEN_TABLE_ID` | Optioneel. Default: `3` |

Aanmaken: GitHub → repo → Settings → Secrets and variables → Actions. Dit PR maakt **geen** secrets aan.

Het Nextcloud-account heeft update-recht op tabel Taken nodig.

## Kolommen (vaste ids)

| Column id | Veld | Wanneer |
|---|---|---|
| 21 | Branch | PR-events, workflow_run, dispatch |
| 22 | PR | PR-URL |
| 23 | CI-status | `pending` / `success` / `failure` / `cancelled` / `skipped` / `merged` / `closed` |
| 24 | Deploy | Alleen bij deploy-signalen; anders met rust laten |
| 27 | Laatste update | Altijd, UTC `YYYY-MM-DD HH:MM` |

Lege velden worden niet meegestuurd, zodat een CI-update Deploy niet wist.

## Taak-id-conventie

Het getal **is de Nextcloud Tables-rij-id** (niet het GitHub-PR-nummer). Eerste treffer wint:

1. `workflow_dispatch`-input `row_id`
2. Regel in de PR-body (kopjes mag): `Taak: 123`, `Taak: #123`, `Row: 123`, `Row-id: 123`, `Nextcloud-row: 123`
3. Branchnaam: `taak-123`, `T-123` / `t-123`, `row-123` (streepje, underscore of slash)

Voorbeelden: `cursor/taak-12-login`, `feature/T-12-bonnetjes`. Cursor-branches zonder prefix (`cursor/foo-5da0`) matchen niet — zet dan `Taak: 12` in de PR-body.

Zonder id: logregel en exit 0.

## Triggers en statuswaarden

| Event | Schrijft |
|---|---|
| `pull_request` opened / synchronize / reopened | Branch, PR, CI-status=`pending` |
| `pull_request` edited | Branch, PR (CI/Deploy ongewijzigd) |
| `pull_request` closed, gemerged | CI-status=`merged` |
| `pull_request` closed, niet gemerged | CI-status=`closed` |
| `workflow_run` voltooid van **Holding Checks** | CI-status=`success`/`failure`/… |
| `workflow_run` voltooid van **Deploy to NUC** | Deploy=`success`/`failure`/… |
| `deployment_status` | Deploy uit GitHub Deployment-state |
| `workflow_dispatch` | Test tegen een opgegeven rij |

`workflow_run` draait pas vanaf de default branch (`master`). Tot merge test je via `pull_request` (zelfde repo) of `workflow_dispatch`.

### Deploy: TODO / handmatig

Het bestaande `deploy.yml` (`Deploy to NUC`) maakt **geen** GitHub Deployment-objecten. Daarom:

- `deployment_status` is aangesloten maar vuurt nu niet.
- Als praktische mapping wordt **Deploy to NUC**-voltooiing wél naar kolom 24 geschreven (zonder `deploy.yml` te wijzigen).
- Tot die workflow groen is, mag Deploy handmatig in Taken blijven.

Fork-PR’s (public repo) worden overgeslagen; secrets komen daar sowieso niet.

## Geverifieerde API (niet raden)

Bron: officiële OpenAPI van nextcloud/tables, [openapi.json op `main`](https://raw.githubusercontent.com/nextcloud/tables/main/openapi.json) (leesbaar via [Swagger Petstore](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/nextcloud/tables/main/openapi.json)). OCS-header: [OCS APIs overview](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-api-overview.html). Update-route in bron: [RowOCSController.php](https://github.com/nextcloud/tables/blob/main/lib/Controller/RowOCSController.php).

| Actie | API | Endpoint | Body |
|---|---|---|---|
| Rij lezen | **v1** REST | `GET /index.php/apps/tables/api/1/rows/{rowId}` | — |
| Rijen van een tabel lijsten | **v1** REST | `GET /index.php/apps/tables/api/1/tables/{tableId}/rows` | — |
| Rij bijwerken op column id | **v2** OCS | `PUT /ocs/v2.php/apps/tables/api/2/tables/{tableId}/rows/{rowId}` | `{"data": {"21": "…", "22": "…"}}` |

v2 OCS op `main` heeft **geen** authenticated GET om rijen van een tabel te lezen (alleen POST aanmaken en PUT/DELETE op `{rowId}`). Daarom: lezen via v1, schrijven via v2. v1 `PUT /index.php/apps/tables/api/1/rows/{rowId}` kan hetzelfde schrijven, maar deze workflow gebruikt v2 + header `OCS-APIRequest: true`.

Auth: HTTP Basic (`NEXTCLOUD_USER` + app-password). JSON-`Accept`. Datetime (kolom 27): `YYYY-MM-DD HH:MM` (UTC), zoals de Tables datetime-parser opslaat.

CI-status en Deploy worden als tekst gestuurd. Zijn die kolommen in Taken een selectie-type, dan alleen labels/opties gebruiken die in de tabel bestaan — anders faalt de write zacht.

## Testen met `workflow_dispatch`

1. Secrets/variables zetten (namen hierboven).
2. In Taken een **testrij** aanmaken; noteer de rij-id.
3. Actions → **Nextcloud Taken sync** → Run workflow, op deze branch.
4. Input `row_id` = testrij. Zet `dry_run` aan om alleen de payload te zien.
5. Zonder dry-run: controleer Branch / PR / CI-status / Laatste update op de testrij.
6. Job mag geel/skipped zijn bij ontbrekende secrets; de PR moet groen blijven (`continue-on-error` + exit 0).

## Beveiliging

- Geen `pull_request_target`.
- Fork-PR’s: job `if` slaat schrijven over.
- `workflow_run` / `deployment_status` checken de default branch uit, niet de PR-head.
- Minimale `permissions`: `contents: read`, `pull-requests: read`.
- Secrets worden niet gelogd; payload-log bevat alleen boardvelden.
- Actions gepind op major (`actions/checkout@v4`).
