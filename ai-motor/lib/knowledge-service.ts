import {
  describeQdrantCollectionsForScope,
  logQdrantCollectionPlan,
} from "@/lib/qdrant-collection";
import { buildQdrantSearchFilter } from "@/lib/qdrant-payload";
import {
  resolveWorkspaceIdBySlug,
  workspaceSlugForKlant,
} from "@/lib/workspace-context";

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  "",
);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
  /\/$/,
  "",
);
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

export type QdrantHit = {
  id?: unknown;
  score?: number;
  payload?: Record<string, unknown>;
};

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
  const data = (await res.json()) as { embedding?: number[] };
  return data.embedding || [];
}

/** Vector voor Qdrant-upserts (zelfde Ollama-embeddings als search). */
export async function embedForQdrant(text: string): Promise<number[]> {
  return getEmbedding(text.slice(0, 8000));
}

export function payloadText(hit: QdrantHit): string {
  const p = hit.payload || {};
  const raw =
    p.text ??
    p.content ??
    p.body ??
    p.chunk ??
    p.document ??
    p.page_content;
  if (typeof raw === "string") return raw;
  return JSON.stringify(p).slice(0, 4000);
}

/** Iets meer context voor chat-preambles (bron + ingest-tijd waar aanwezig). */
export function payloadTextWithProvenance(hit: QdrantHit): string {
  const body = payloadText(hit);
  const p = hit.payload || {};
  const bits: string[] = [body];
  const src =
    (typeof p.canonical_source === "string" && p.canonical_source.trim()) ||
    (typeof p.source === "string" && p.source.trim()) ||
    (typeof p.source_filename === "string" && p.source_filename.trim()) ||
    (typeof p.uri === "string" && p.uri.trim());
  if (src) bits.push(`(bron: ${src})`);
  const when =
    (typeof p.ingested_at === "string" && p.ingested_at.trim()) ||
    (typeof p.updated_at === "string" && p.updated_at.trim());
  if (when) bits.push(`(index: ${when})`);
  return bits.join(" ");
}

/**
 * Vector search in Qdrant (zelfde logica als /api/qdrant/search), voor server-side automation.
 * Fan-out naar ingest-collectie (`factory_os_{klant}`) én scrape-collectie (`{klant}_kennisbank`).
 */
async function searchQdrantCollection(
  collection: string,
  vector: number[],
  opts: { klant?: string; workspaceId?: string | null; limit: number }
): Promise<{ results: QdrantHit[]; error?: string; missing?: boolean }> {
  const body: Record<string, unknown> = {
    vector,
    limit: opts.limit,
    with_payload: true,
  };

  const filter = buildQdrantSearchFilter({
    tenant: opts.klant,
    workspaceId: opts.workspaceId,
  });
  if (filter) body.filter = filter;

  const res = await fetch(
    `${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (res.status === 404) {
    return { results: [], missing: true };
  }

  const text = await res.text();
  if (!res.ok) {
    return { results: [], error: text || `Qdrant ${res.status} (${collection})` };
  }

  const data = JSON.parse(text) as { result?: QdrantHit[] };
  const results = Array.isArray(data.result) ? data.result : [];
  return { results };
}

export async function searchKnowledge(
  query: string,
  opts?: {
    klant?: string;
    limit?: number;
    workspaceId?: string | null;
  },
): Promise<{
  results: QdrantHit[];
  error?: string;
  collections?: string[];
}> {
  const q = query.trim();
  if (!q) return { results: [], error: "empty query" };

  try {
    const vector = await getEmbedding(q);
    if (!vector.length) {
      return { results: [], error: "embedding failed" };
    }

    const cap = Math.min(Number(opts?.limit) || 10, 50);
    const klant = opts?.klant;
    const workspaceId =
      opts?.workspaceId ??
      (klant
        ? await resolveWorkspaceIdBySlug(workspaceSlugForKlant(klant))
        : null);
    const plan = logQdrantCollectionPlan("search", klant);
    const collections = plan.search;

    const searches = await Promise.all(
      collections.map((collection) =>
        searchQdrantCollection(collection, vector, {
          klant,
          workspaceId,
          limit: cap,
        })
      )
    );

    const perCollection = collections.map((name, i) => ({
      name,
      hits: searches[i]?.results.length ?? 0,
      missing: searches[i]?.missing === true,
      error: searches[i]?.error,
    }));

    const errors = searches
      .filter((s) => s.error)
      .map((s) => s.error as string);
    const merged = searches.flatMap((s) => s.results);
    merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const results = merged.slice(0, cap);

    if (results.length === 0) {
      const allMissing = perCollection.every((c) => c.missing);
      const ingestPlan = describeQdrantCollectionsForScope(klant);
      console.warn(
        `[qdrant:search] 0 hits klant=${plan.klant} query=${JSON.stringify(q.slice(0, 80))} collections=${JSON.stringify(perCollection)} ingest=${ingestPlan.ingest}${allMissing ? " — all buckets missing; check Qdrant or run migrate script" : ""}`
      );
    } else {
      const emptyBuckets = perCollection.filter((c) => c.hits === 0);
      if (emptyBuckets.length > 0 && emptyBuckets.length < perCollection.length) {
        console.info(
          `[qdrant:search] partial klant=${plan.klant} empty=${emptyBuckets.map((c) => c.name).join(", ")}`
        );
      }
    }

    return {
      results,
      collections,
      error:
        errors.length > 0 && results.length === 0
          ? errors.join("; ")
          : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { results: [], error: msg };
  }
}
