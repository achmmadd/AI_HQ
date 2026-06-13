# Qdrant ingest — canonical paths

**Canonical script:** `~/AI_HQ/ai-motor/scripts/qdrant_ingest_kennisbank.py`  
**Wrapper (use this from cron/shell):** `~/AI_HQ/scripts/run_qdrant_ingest_kennisbank.sh`

**Legacy path:** `~/AI_HQ/scripts/qdrant_ingest_kennisbank.py` — root-owned **symlink** naar het canonical script (functioneel OK). Om eigenaar te wijzigen (optioneel):

```bash
sudo chown -h "$USER:$USER" ~/AI_HQ/scripts/qdrant_ingest_kennisbank.py
```

SSOT: `ai-motor/lib/qdrant-collection.ts` — ingest/search use `factory_os_{klant}` (default `factory_os_fumero`).

**Backup:** `~/AI_HQ/scripts/run_factory_os_backup.sh` (scoped snapshots; legacy `factory_os_backup.sh` is root-owned en verouderd).

**MCP finalize:** `~/AI_HQ/scripts/run_factory_os_v3_finalize.sh` (legacy `factory_os_v3_finalize.sh` is root-owned en verouderd).

**Restore runbook:** `~/AI_HQ/factory-os/docs/QDRANT_BACKUP_RESTORE_SCOPED.md` (legacy `QDRANT_RESTORE_RUNBOOK.md` is root-owned).
