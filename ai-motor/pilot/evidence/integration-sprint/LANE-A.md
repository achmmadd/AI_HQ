# Spoor A — Adversariële hardening-review (pilot/spine)

> **Datum:** 2026-08-14 · **Uitvoerder:** coördinator (agents crashten herhaaldelijk; spoor in de foreground afgerond)
> **Basis:** `pilot/spine` @ `e3558c5` + Fase-0 seam (`65185e2`)
> **Scope:** alleen `ai-motor/pilot/**` + `ai-motor/infra/pilot/compose.yaml`. Geen legacy-imports toegevoegd.

## Verdict per punt

| # | Punt | Status | Fix |
|---|---|---|---|
| 1 | Settlement bindt geen causale velden (receipt_id alleen, hergebruikbaar over runs) | **GEFIXT** | v2-payload: `nonce`, `capability`, `tool`, `workspace_id`, `task_id`, `run_id`, `attempt_id`, `policy_id`, `policy_version`, `policy_digest`, `issued_at` — alles in de HMAC. Per-veld-tamper → DENY (test 7b). |
| 2 | Beslisclaim niet atomair (check-then-act) | **GEFIXT** | `claim()` via `open(wx)` — exclusief aanmaken is de atomaire operatie; geen TOCTOU meer (test 7e). |
| 3 | Geen nonce; replay binnen TTL mogelijk | **GEFIXT** | `nonce` in v2-payload + sig-claim op volledige handtekening (nonce maakt elke settlement uniek). Race-test 7c: 20 parallel → 1 write. |
| 4 | `already_decided` check niet atomair | **GEFIXT** | `decision-<draft_run_id>`-claim vóór append, zelfde atomaire mechanisme als sig-claim (test 7e). |
| 5 | Zwak/leeg `PILOT_STORE_SECRET` | **GEFIXT** | `isValidStoreSecret`: exact 64 lowercase hex (32 bytes). API, besliskern én store weigeren anders te starten/verwerken. |
| 6 | `DecisionDeps.storeFn` te smal getypeerd | **GEFIXT** | `typeof storeDraftViaService` (accepteert `StoreRecord`-unie). |
| 7 | Ongeldige `CONTEXT_MODE` valt stil terug op demo | **GEFIXT** | `contextModeFromEnv` gooit `context_mode_invalid` bij elke niet-lege onbekende waarde; API valideert bij opstarten en stopt (exit 1). CLI mount nu expliciet `pilot-context:/context:ro` — geen schijnconfiguratie meer (test 7a, 7g). |
| 8 | Crash na claim vóór append ongetest | **GEFIXT** | `beforeAppend`-hook + test 7d: crash → 500, retry → `settlement_replayed`, nul regels geschreven. At-most-once bewezen. |

## Extra bewijzen

- **7c** settlement-race: 20 gelijktijdige identieke settlements → exact één 200, negentien `settlement_replayed`, één regel in `drafts.jsonl`.
- **7f** na een approved-beslissing blijven `review.reply.publish`, `mail.send`, `payment.create`, `device.control` gesloten (evaluate ≠ ALLOW, execute zonder receipt → niet uitgevoerd).
- **7g** mountmatrix als test: store mount nooit `pilot-context`; API/CLI lezen hooguit read-only; alle services `cap_drop: ALL` + `no-new-privileges`.

## Bewuste niet-fixes (gedocumenteerd)

- **At-most-once i.p.v. exactly-once**: een crash ná claim vóór append verliest de write (retry is onmogelijk — het bewijs is gebrand). Voor een append-only auditstore is nooit-dubbel de juiste keuze; verlies is zichtbaar als 500 in de evidence van de run.
- **WhoIs blijft best-effort**: tailnet-IP → node via LocalAPI; zonder tailnet is de API fysiek onbereikbaar (bind op tailnet-IP). Geen wijziging.
- **v1-settlements worden afgewezen** (`settlement_required` op shape, `unsupported_version` op verify): bewuste breaking change binnen de gesloten pilot; geen migratie nodig.

## Validatie

Builder (Docker op Hetzner): `node --test pilot/*.test.ts` + `tsc --noEmit` + `eslint` — zie CI-run op `pilot/integration` na merge. Alle 7x-tests groen op de builder vóór push.
