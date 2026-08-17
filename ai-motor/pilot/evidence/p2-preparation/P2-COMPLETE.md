# P2-COMPLETE — synthetische tailnet `/motor`

```text
P2_STATUS=CLOSED_SYNTHETIC
BRANCH=pilot/p2.0-motor-kiosk
LOCAL_HEAD=e8b567157a4350ea3095d8aedd35acbca6b20602
LIVE_CONSOLE_SHA=fd8ac3d265a08849b15e9c449e5ee9c3e5be0597
LIVE_ORIGIN=http://100.97.30.22:4420/motor
LIVE_JOURNAL=no
LIVE_ROLE_SPLIT=no
CI_PUSH=deferred
TEST_COUNTS=295 pass / 0 fail / 1 skip
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
LIVE_AUTHORITY=NONE
P0_UNCHANGED=yes
DEPLOYED_P2_1=no
PUSHED=no
```

P2 is hiermee **synthetisch gesloten**. Dat is geen Kernel, geen tweede
product en geen live-authority. Publish/mail/payment/device-control blijven
DENY. NUC is geen reviewer.

## Wat af is

| Slice | Waar | Inhoud |
|---|---|---|
| P2.0 console | **live** Hetzner `motor-p2-ui` | tailnet `/motor` op `:4420`; P0 `:4400` ongemoeid |
| P2.0 kiosk | **bewust gestopt** | NUC headless, geen X/HDMI; laptop is de browser |
| Role-split | **lokaal** `d739103`–`67a275a` | NUC alleen orchestrator health/ready; nooit UI/review |
| P2.1 journal | **lokaal** `e8b5671` | append-only JSONL, templates, reconstructie, context-gate |
| Tests | **lokaal groen** | 295 pass / 0 fail / 1 skip (bestaande conformance-skip) |

## Wat expres open blijft

- GitHub-push van `d739103` t/m `e8b5671` (workflow-scope later).
- `ACTIVATE P2.1` — journalvolume + recreate `motor-p2-ui`.
- Live ACL-split: NUC uit `PILOT_P2_ACL`, `PILOT_P2_ORCHESTRATOR_ACL` zetten.
- Formele P1-evidenceclose (`CLOSED_SYNTHETIC`) — eigenaarstekening.
- Echte private context / kennis — niet in P2.

## Live versus lokaal

Live draait nog de P2.0-checkout `fd8ac3d`: synthetische in-memory review,
NUC nog in de oude P2-ACL, geen journalvolume. Nieuwere commits bestaan
alleen in deze Cursor-checkout tot er gepusht en apart geactiveerd wordt.

## Evidence

- `P2.0-PLAN.md` — goedgekeurd plan
- `P2.0-PREP.md` — lokale prep vóór activatie
- `P2.0-ACTIVATE.md` — live console, kiosk geblokkeerd
- `P2.0-ORCHESTRATOR.md` / `P2.0-ROLE-SPLIT.md` — NUC-contract
- `P2.1-JOURNAL.md` — lokale journalcode

Geen master-merge, geen publieke ingress, geen Hetzner/NUC-mutatie in deze
afsluiting.
