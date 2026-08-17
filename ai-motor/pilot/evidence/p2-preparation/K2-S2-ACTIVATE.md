# K2-S2-ACTIVATE — ReviewReceived-seam live op `:4420`

```text
ACTIVATED=2026-08-17
COMMAND=ACTIVATE K2 S2 LIVE
K2_S2_LIVE=ACTIVE
K2_S2_BUILD=LOCAL_ONLY_GREEN
LIVE_SHA=dd0e1a433c8968ce97a86151a51c35cd0411a8a0
P2_REPO_PATH=/opt/motor-pilot/repo-p2
MOTOR_P2_UI=recreated only; overlay/.env untouched
PINNED_HEALTH=http://100.97.30.22:4420/motor/health
P2_HEALTH=200 {"ok":true}
LAPTOP_MOTOR=200
LAPTOP_ORCH=403 orchestrator_denied
LAPTOP_DRAFT_OK=200 draft-p21-tpl-p21-review-reply-7a7ee4c5
LAPTOP_UNKNOWN_TEMPLATE=400 unknown_template
LAPTOP_EXTRA_KEYS=400 free_draft_body_not_allowed
HETZNER_HOST_DRAFT=403 node_not_allowed
NUC_ORCH=200 {"ok":true}
NUC_MOTOR=403
NUC_DRAFT=403 node_not_allowed
JOURNAL_VOLUME=motor-pilot_pilot-p2-review
JOURNAL_PATH=/p2-review/outcome-review.jsonl
JOURNAL_LINES=25 → 26
JOURNAL_NEW_EVENT=draft_created actor=n42QGiXouB21CNTRL
P0_UNCHANGED=yes
P0_LIVE_SHA=fc37d90c853b4e1760aae7770b14020cf2d9b18e
P0_API_ID=64dc3839c220759f2286f953e459096429b73f8d7d75f86418fcdfeb49bdc553
P0_STORE_ID=0ec7b3a3f1be4dd7bec3161cb0f4f23896df65893112675377c8b3f1f6417fbf
P0_ROOT=200
P0_HEALTH=200 {"ok":true,"model":true}
P0_LISTEN=100.97.30.22:4400
P2_LISTEN=100.97.30.22:4420
WHOIS_AUTHORITY_PRESERVED=yes
HARDCODED_LAPTOP_ACTOR=no
NEW_ROUTE=no
NEW_EVENT_TYPE=no
OVERLAY_CHANGE=no
ENV_CHANGE=no
COMPOSE_DOWN=no
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
BUILD_CI=https://github.com/achmmadd/AI_HQ/actions/runs/32033017918
TEST_COUNTS=304 pass / 0 fail / 1 skip
```

## Wat live gezet is

1. `/opt/motor-pilot/repo-p2` fast-forward `fbb297b` → `dd0e1a4`.
2. Overlay `/opt/motor-pilot/compose.p2-motor.yaml` **niet** herschreven
   (byte-gelijk aan checkout; mtime 2026-08-17 11:24 UTC).
3. `.env` / `PILOT_P2_ACL` **niet** gewijzigd (mtime 2026-08-17 11:24 UTC).
4. `docker compose -f compose.yaml -f compose.p2-motor.yaml up -d --no-deps --force-recreate motor-p2-ui`.
5. Alleen `motor-p2-ui` opnieuw aangemaakt (`0c71925f5e8b` → `b663d6b0ddc6`).

Geen nieuwe HTTP-route, webhook, n8n, Telegram, Kernel, Gateway, SQLite,
Postgres, ACL of tweede store. `POST /api/motor/draft` roept na WhoIs +
`PILOT_P2_ACL` `receiveSyntheticReview` aan met `{ synthetic_template_id }`
en `verifiedActor` uit `access.node.stableId`.

## Role-split (hergemeten na recreate)

| Client | `/motor` | `/motor/orchestrator/health` | `POST /api/motor/draft` |
|---|---|---|---|
| Laptop `n42QGiXouB21CNTRL` | 200 | 403 `orchestrator_denied` | 200 allowlist / 400 unknown template |
| NUC `nkcmY58XEw11CNTRL` | 403 | 200 `{"ok":true}` | 403 `node_not_allowed` |
| Hetzner host zelf | 403 | 403 `orchestrator_denied` | 403 `node_not_allowed` |

## Bewijs (commandoutput)

```text
# worktree
LIVE_HEAD=dd0e1a433c8968ce97a86151a51c35cd0411a8a0
# mounted code hashes == lokale dd0e1a4
3329931e8b86170c71282c3c97ff16483dd6d44fc07ea23f90076af89c7cb2e4  p2-motor-server.ts
0342cf5bd0441412a0c78e7c666521ea90591f487f115478f36d9824f9199c66  p2-review-received-seam.ts

# health
GET http://100.97.30.22:4420/motor/health → 200 {"ok":true}
GET http://100.97.30.22:4400/health → 200 {"ok":true,"model":true}

# laptop allowlist (WhoIs; extra actor_stable_id genegeerd)
{"ok":true,"draftId":"draft-p21-tpl-p21-review-reply-7a7ee4c5","state":"draft","synthetic_template_id":"tpl-p21-review-reply"}

# laptop unknown template
{"ok":false,"error":"unknown_template"} HTTP 400

# laptop extra keys title/body
{"ok":false,"error":"free_draft_body_not_allowed"} HTTP 400

# host / NUC zonder review-ACL
{"ok":false,"error":"node_not_allowed"} HTTP 403

# journal last line
{"type":"draft_created","actor_stable_id":"n42QGiXouB21CNTRL","draft_id":"draft-p21-tpl-p21-review-reply-7a7ee4c5",...}
# geen nFAKEACTOR, geen ReviewReceived-eventtype
```

## Rollback

```text
docker compose -f compose.yaml -f compose.p2-motor.yaml stop motor-p2-ui
# of: in /opt/motor-pilot/repo-p2 terug naar fbb297bc110672b550e0fe24f817a8493510d4a2
#      daarna alleen motor-p2-ui recreaten
# nooit: docker compose down
```
