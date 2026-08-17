# SPINE-CLOSE — synthetische Motor-spine (P0→P1→P2.1)

```text
SPINE_STATUS=CLOSED_SYNTHETIC
CLOSED_AS=CLOSED_SYNTHETIC
OWNER_SIGN=SIGNED
SIGNED_AT=2026-08-17
SIGNED_FROM_CLOSE_REF=ada1b0bbb78e3cce352252d0f3dc00db3f1a0144
SIGN_COMMAND=SIGN SPINE CLOSED_SYNTHETIC
DATE=2026-08-17
BRANCH=pilot/p2.0-motor-kiosk
EVIDENCE_HEAD=2e8cc870bc9bddf23b43de4f651f9e37ffe440c6
LIVE_CONSOLE_SHA=fbb297bc110672b550e0fe24f817a8493510d4a2
LIVE_ORIGIN=http://100.97.30.22:4420/motor
P0_LIVE_SHA=fc37d90c853b4e1760aae7770b14020cf2d9b18e
P0_LISTEN=100.97.30.22:4400
P2_LISTEN=100.97.30.22:4420
CI_URL=https://github.com/achmmadd/AI_HQ/actions/runs/32025912144
CLOSE_EVIDENCE_CI=https://github.com/achmmadd/AI_HQ/actions/runs/32026184453
TEST_COUNTS=295 pass / 0 fail / 1 skip
TYPES=0
JOURNAL_EVENTS=draft_created=23 review_submitted=1 review_decided=1
JOURNAL_ACTORS=n42QGiXouB21CNTRL
NUC_ACTOR=no
APPROVED_DRAFT=draft-p21-tpl-p21-review-reply-29b52da3
PUBLISH=DENY
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
LIVE_AUTHORITY=NONE
KERNEL=no
GATEWAY=no
POSTGRES_SSOT=no
SQLITE=no
P0_UNCHANGED=yes
```

Eigenaar Pietje tekende **SIGNED** `SIGN SPINE CLOSED_SYNTHETIC` op
2026-08-17 vanaf `ada1b0bbb78e3cce352252d0f3dc00db3f1a0144`. Dit sluit de
**pilot-spine**, niet Motor 2.2. Geen Kernel, geen Action Gateway, geen
Playbook #1, geen private context. Publish/mail/pay/device blijven DENY
tot een latere eigenaarszet. Synthetic, tailnet-only, P0 ongemoeid,
journal P2-only, NUC is geen reviewer, geen public ingress, geen
master-merge.

## Ketting (gemeten)

| Schakel | Status | Bewijs |
|---|---|---|
| P0 ADR-110 + `:4400` | live, ongemoeid deze sessie | `fc37d90`; P0 HTTP 200; container `64dc3839c220` |
| P1 Nu / Projecten / Afdelingen | synthetisch compleet | `p1-foundation/P1-COMPLETE.md` |
| P2 `/motor` tailnet | live `fbb297b` | health 200; laptop `/motor` 200 |
| Role-split | live | laptop UI 200 / orch 403; NUC UI 403 / orch 200 |
| Journal | live JSONL | `/p2-review/outcome-review.jsonl`; geen SQLite/PG |
| Eén goedgekeurde keten | live | draft→in_review→approved; publish DENY |
| Pilot Spine CI | groen | [run 32025912144](https://github.com/achmmadd/AI_HQ/actions/runs/32025912144) |
| Close-evidence CI | groen | [run 32026184453](https://github.com/achmmadd/AI_HQ/actions/runs/32026184453) |
| Eigenaarstekening | SIGNED | `SIGN SPINE CLOSED_SYNTHETIC` @ 2026-08-17 |

## Grenzen die open blijven ( expresse )

- P1-handtekening zit in dezelfde zet (geen tweede product).
- K2/n8n Playbook #1, private context-volume, NUC-orchestrator-script,
  Hermes/AgentScope live-wiring, Kernel/Gateway, master-merge.

## Rollback P2

```text
docker compose -f compose.yaml -f compose.p2-motor.yaml stop motor-p2-ui
# nooit: docker compose down
```
