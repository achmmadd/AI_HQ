const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
  /\/$/,
  ""
);
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const COLLECTION = process.env.QDRANT_COLLECTION || "factory_os";

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

/**
 * Vector search in Qdrant (zelfde logica als /api/qdrant/search), voor server-side automation.
 */
export async function searchKnowledge(
  query: string,
  opts?: { klant?: string; limit?: number }
): Promise<{ results: QdrantHit[]; error?: string }> {
  const q = query.trim();
  if (!q) return { results: [], error: "empty query" };

  try {
    const vector = await getEmbedding(q);
    if (!vector.length) {
      return { results: [], error: "embedding failed" };
    }

    const cap = Math.min(Number(opts?.limit) || 10, 50);
    const body: Record<string, unknown> = {
      vector,
      limit: cap,
      with_payload: true,
    };

    const klant = opts?.klant;
    if (klant && ["fumero", "bokas"].includes(klant)) {
      body.filter = {
        must: [{ key: "client", match: { value: klant } }],
      };
    }

    const res = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION}/points/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );

    const text = await res.text();
    if (!res.ok) {
      return { results: [], error: text || `Qdrant ${res.status}` };
    }

    const data = JSON.parse(text) as { result?: QdrantHit[] };
    const results = Array.isArray(data.result) ? data.result : [];
    return { results };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { results: [], error: msg };
  }
}
