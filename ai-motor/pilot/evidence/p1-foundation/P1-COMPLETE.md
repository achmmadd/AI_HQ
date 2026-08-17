# P1-COMPLETE — synthetische Motor-workspace

```text
P1_STATUS=COMPLETE_SYNTHETIC
BRANCH=pilot/p1-continuous
P0_REGRESSION=225 pass / 0 fail / 1 skip
P1_ACCEPTANCE=yes
CI_TRIGGER_NEEDED=yes
REAL_CONTEXT_USED=no
EXTERNAL_EFFECTS=no
PUBLIC_INGRESS=no
MASTER_MERGE=no
LIVE_AUTHORITY=NONE
```

## Acceptatie

Bruikbare synthetische `/motor`-ervaring:

- Nu — inbox met filters, attention → project, evidence-rail
- Projecten — workbench, taken, artifacts, drafts, reviews
- Afdelingen — configureerbaar + Human/AI-roster + BlockManifest-gallery
- Typen maakt alleen een lokale draft
- draft → in_review → approved|rejected
- Publish altijd zichtbaar én technisch DENY
- Tenant `ws-anders` fail-closed
- NUC-kiosk alleen voorbereid, niet geactiveerd

## P2-blockers (niet gebouwd in P1; P2.1 dekt de live console)

- Echte bedrijfscontext (`CONTEXT_MODE=private` is P0-gate, vullen is eigenaar)
- Duurzame persistence in Postgres (P2.1 = JSONL-journal, geen PG-cutover)
- Eerste echte koppeling met extern effect
- Master-merge
- Publieke ingress

Live `/motor` op Hetzner `:4420` is P2.1, niet P1.
