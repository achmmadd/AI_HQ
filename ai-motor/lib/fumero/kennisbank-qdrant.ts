import { embedForQdrant } from "@/lib/knowledge-service";
import {
  chunkMarkdownForQdrant,
  scrapeUrlDocumentId,
  type ScrapeUrlResult,
} from "@/lib/fumero/scrape-url";
import { ensureQdrantCollection } from "@/lib/qdrant-ingest";

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);

export function fumeroKennisbankCollection(): string {
  return (
    process.env.QDRANT_FUMERO_KENNISBANK_COLLECTION?.trim() ||
    "fumero_kennisbank"
  );
}

export async function upsertScrapedPageToKennisbank(opts: {
  scrape: Extract<ScrapeUrlResult, { ok: true }>;
  category?: string;
}): Promise<{ upserted: number; collection: string } | { error: string }> {
  const collection = fumeroKennisbankCollection();
  const chunks = chunkMarkdownForQdrant(opts.scrape.markdown);
  if (!chunks.length) return { error: "Geen tekst om te indexeren" };

  const documentId = scrapeUrlDocumentId(opts.scrape.url);
  const ingested_at = opts.scrape.fetchedAt;
  const category = opts.category?.trim() || "website_scrape";

  const firstVec = await embedForQdrant(chunks[0].slice(0, 8000));
  if (!firstVec.length) {
    return { error: "Embedding mislukt (Ollama?)" };
  }

  const ensured = await ensureQdrantCollection(collection, firstVec.length);
  if (!ensured.ok) return { error: ensured.error };

  const BATCH = 32;
  let upserted = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const points: Array<{
      id: number;
      vector: number[];
      payload: Record<string, unknown>;
    }> = [];

    for (let j = 0; j < slice.length; j++) {
      const chunkIndex = i + j;
      const text = slice[j];
      const vector =
        j === 0 && i === 0
          ? firstVec
          : await embedForQdrant(text.slice(0, 8000));
      if (!vector.length) {
        return { error: `Embedding mislukt bij chunk ${chunkIndex}` };
      }

      const id = documentId * 1_000 + chunkIndex;
      points.push({
        id,
        vector,
        payload: {
          text,
          client: "fumero",
          category,
          tags: ["scrape_url", "kennisbank_refresh"],
          source_filename: opts.scrape.url,
          canonical_source: opts.scrape.url,
          chunk_index: chunkIndex,
          document_id: documentId,
          ingested_at,
          doc_kind: "web_scrape",
        },
      });
    }

    const res = await fetch(
      `${QDRANT_URL}/collections/${collection}/points?wait=true`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
        signal: AbortSignal.timeout(120_000),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      return { error: t || `Qdrant upsert ${res.status}` };
    }
    upserted += points.length;
  }

  return { upserted, collection };
}
