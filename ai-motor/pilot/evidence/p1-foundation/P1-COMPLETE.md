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

## P2-blockers (niet gebouwd)

- Echte bedrijfscontext (`CONTEXT_MODE=private` is P0-gate, vullen is eigenaar)
- Live `/motor` op Hetzner/NUC (deploy)
- Duurzame persistence (geen SQLite/nieuwe PG-migratie in P1)
- Eerste echte koppeling met extern effect
- Master-merge
- Publieke ingress
