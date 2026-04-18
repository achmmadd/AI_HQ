# Qdrant — snapshot backup & restore

## Backup (per collection)

```bash
curl -s -X POST "http://localhost:6333/collections/factory_os/snapshots" | tee /tmp/qdrant_snapshot_factory_os.json
```

Snapshotbestanden staan op Qdrant-storage (Docker-volume `qdrant_storage`).

## Restore

1. Qdrant docs: [Snapshots](https://qdrant.tech/documentation/concepts/snapshots/)
2. Test eerst op een kopie van het volume.
