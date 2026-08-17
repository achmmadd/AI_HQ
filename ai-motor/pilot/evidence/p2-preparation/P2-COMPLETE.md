# P2-COMPLETE — synthetische tailnet `/motor`

```text
P2_STATUS=LIVE_P2_1
BRANCH=pilot/p2.0-motor-kiosk
LOCAL_HEAD=bc3f864fe137fa38068f0f47d84a0506b76f77ae
LIVE_CONSOLE_SHA=bc3f864fe137fa38068f0f47d84a0506b76f77ae
LIVE_ORIGIN=http://100.97.30.22:4420/motor
LIVE_JOURNAL=yes
LIVE_ROLE_SPLIT=yes
CI_PUSH=yes
CI_RUN=https://github.com/achmmadd/AI_HQ/actions/runs/32024164489
TEST_COUNTS=252 pass / 0 fail / 1 skip (local scoped); Pilot Spine green
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
LIVE_AUTHORITY=NONE
P0_UNCHANGED=yes
DEPLOYED_P2_1=yes
PUSHED=yes
```

P2.1 is **live op de isolated console**. Dat is geen Kernel, geen tweede
product en geen live-authority. Publish/mail/payment/device-control blijven
DENY. NUC is geen reviewer.

## Wat af is

| Slice | Waar | Inhoud |
|---|---|---|
| P2.0 console | **live** Hetzner `motor-p2-ui` | tailnet `/motor` op `:4420`; P0 `:4400` ongemoeid |
| P2.0 kiosk | **bewust gestopt** | NUC headless, geen X/HDMI; laptop is de browser |
| Role-split | **live** | NUC alleen orchestrator health/ready; nooit UI/review |
| P2.1 journal | **live volume** | `/p2-review` op `motor-pilot_pilot-p2-review`; nog leeg tot eerste event |
| GitHub + CI | **groen** | [Pilot Spine 32024164489](https://github.com/achmmadd/AI_HQ/actions/runs/32024164489) |

## Wat expres open blijft

- Formele P1-evidenceclose (`CLOSED_SYNTHETIC`) — eigenaarstekening.
- Echte private context / kennis — niet in P2.
- NUC-orchestrator-script (`MOTOR_P2_ORCHESTRATOR=1`) — niet gekopieerd, niet gestart.
- Master-merge.

## Evidence

- `P2.0-PLAN.md` — goedgekeurd plan
- `P2.0-PREP.md` — lokale prep vóór activatie
- `P2.0-ACTIVATE.md` — eerste live console, kiosk geblokkeerd
- `P2.0-ORCHESTRATOR.md` / `P2.0-ROLE-SPLIT.md` — NUC-contract
- `P2.1-JOURNAL.md` — journalcode
- `P2.1-ACTIVATE.md` — deze live-meting
