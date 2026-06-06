import { listMonitoredQdrantCollections } from "@/lib/qdrant-collection";

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);

export type QdrantCollectionStatus = {
  name: string;
  exists: boolean;
  points_count?: number;
  error?: string;
};

export async function probeQdrantCollections(): Promise<{
  ok: boolean;
  collections: QdrantCollectionStatus[];
  error?: string;
}> {
  const names = listMonitoredQdrantCollections();
  const collections: QdrantCollectionStatus[] = [];

  try {
    const listRes = await fetch(`${QDRANT_URL}/collections`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!listRes.ok) {
      const t = await listRes.text();
      return {
        ok: false,
        collections: names.map((name) => ({
          name,
          exists: false,
          error: t || `Qdrant ${listRes.status}`,
        })),
        error: t || `Qdrant ${listRes.status}`,
      };
    }

    const listData = (await listRes.json()) as {
      result?: { collections?: Array<{ name?: string }> };
    };
    const existing = new Set(
      (listData.result?.collections ?? [])
        .map((c) => c.name)
        .filter(Boolean) as string[]
    );

    for (const name of names) {
      if (!existing.has(name)) {
        collections.push({ name, exists: false });
        continue;
      }

      try {
        const detailRes = await fetch(`${QDRANT_URL}/collections/${name}`, {
          signal: AbortSignal.timeout(6_000),
        });
        if (!detailRes.ok) {
          collections.push({
            name,
            exists: true,
            error: `detail ${detailRes.status}`,
          });
          continue;
        }
        const detail = (await detailRes.json()) as {
          result?: { points_count?: number };
        };
        collections.push({
          name,
          exists: true,
          points_count: detail.result?.points_count,
        });
      } catch (e) {
        collections.push({
          name,
          exists: true,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const ok = collections.some((c) => c.exists && (c.points_count ?? 0) > 0);
    return { ok, collections };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      collections: names.map((name) => ({ name, exists: false, error: msg })),
      error: msg,
    };
  }
}
