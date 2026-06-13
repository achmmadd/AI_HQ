# Qdrant — snapshot backup & restore (scoped collections)

SSOT: `ai-motor/lib/qdrant-collection.ts` / `scripts/lib/qdrant-collection.sh`.

> Root-owned `factory-os/docs/QDRANT_RESTORE_RUNBOOK.md` is legacy (single `factory_os`). This doc is canonical.

## Backup

```bash
bash ~/AI_HQ/scripts/run_factory_os_backup.sh
```

Handmatig per collection:

```bash
curl -s -X POST "http://localhost:6333/collections/factory_os_fumero/snapshots" \
  | tee /tmp/qdrant_snapshot_factory_os_fumero.json
```

Monitored buckets: `factory_os_fumero`, `fumero_kennisbank`, `factory_os_bokas`, `bokas_kennisbank`, `factory_os_motor`.

## Restore

1. [Qdrant snapshots](https://qdrant.tech/documentation/concepts/snapshots/)
2. Test on a volume copy first.
3. Verify: `curl -s http://localhost:6333/collections/factory_os_fumero`
