import { embedForQdrant } from "@/lib/knowledge-service";
import { qdrantCollectionForScope } from "@/lib/qdrant-collection";
import {
  buildMultitenantPayloadFields,
  type QdrantPayloadSource,
} from "@/lib/qdrant-payload";

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);

export type KnowledgeChunkPayload = {
  text: string;
  client: string;
  tenant: string;
  source: QdrantPayloadSource;
  workspace_id?: string;
  category: string;
  tags: string[];
  source_filename: string;
  chunk_index: number;
  document_id: number;
  ingested_at: string;
  doc_kind: "file" | "chat";
  /** Optioneel: waar de SSOT staat (URL, vault-pad, Confluence-ID, …). */
  canonical_source?: string;
};

/** Haal collectie op; bij 404 aanmaken met vector size (Cosine). */
export async function ensureQdrantCollection(
  collection: string,
  vectorSize: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const get = await fetch(`${QDRANT_URL}/collections/${collection}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (get.ok) return { ok: true };

  if (get.status !== 404) {
    const t = await get.text();
    return { ok: false, error: t || `Qdrant ${get.status}` };
  }

  const put = await fetch(`${QDRANT_URL}/collections/${collection}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!put.ok) {
    const t = await put.text();
    return { ok: false, error: t || `Qdrant create ${put.status}` };
  }
  return { ok: true };
}

function collectionForKlant(klant: string): string {
  return qdrantCollectionForScope(klant);
}

/**
 * Upsert chunks naar de klantcollectie. IDs: deterministisch uit document_id + index
 * (heringest zelfde punten overschrijft — idempotent binnen één doc).
 */
export async function upsertKnowledgeChunks(opts: {
  klant: string;
  documentId: number;
  chunks: string[];
  workspaceId?: string | null;
  /** Qdrant multitenant source tag (default file ingest). */
  payloadSource?: QdrantPayloadSource;
  docKind?: KnowledgeChunkPayload["doc_kind"];
  basePayload: Omit<
    KnowledgeChunkPayload,
    | "text"
    | "chunk_index"
    | "document_id"
    | "ingested_at"
    | "doc_kind"
    | "tenant"
    | "source"
    | "workspace_id"
  >;
}): Promise<{ upserted: number; collection: string } | { error: string }> {
  const {
    klant,
    documentId,
    chunks,
    basePayload,
    workspaceId,
    payloadSource = "file",
    docKind = "file",
  } = opts;
  if (!chunks.length) return { error: "Geen chunks" };

  const collection = collectionForKlant(klant);
  const ingested_at = new Date().toISOString();
  const multitenant = buildMultitenantPayloadFields({
    tenant: klant,
    source: payloadSource,
    workspaceId,
  });

  const firstVec = await embedForQdrant(chunks[0].slice(0, 8000));
  if (!firstVec.length) return { error: "Embedding mislukt (Ollama?)" };

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
      if (!vector.length) return { error: `Embedding mislukt bij chunk ${chunkIndex}` };

      const id = documentId * 1_000_000 + chunkIndex;
      const payload: KnowledgeChunkPayload = {
        ...basePayload,
        ...multitenant,
        text,
        chunk_index: chunkIndex,
        document_id: documentId,
        ingested_at,
        doc_kind: docKind,
      };
      points.push({
        id,
        vector,
        payload: payload as unknown as Record<string, unknown>,
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
