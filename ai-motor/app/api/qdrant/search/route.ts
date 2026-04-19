import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const { query, klant, limit = 10 } = (await req.json()) as {
      query?: string;
      klant?: string;
      limit?: number;
    };

    if (!query?.trim()) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const vector = await getEmbedding(query);
    if (!vector.length) {
      return NextResponse.json({ error: "embedding failed" }, { status: 500 });
    }

    const cap = Math.min(Number(limit) || 10, 50);
    const body: Record<string, unknown> = {
      vector,
      limit: cap,
      with_payload: true,
    };

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
      return NextResponse.json(
        { error: text || res.statusText },
        { status: res.status }
      );
    }

    const data = JSON.parse(text) as { result?: unknown[] };
    const results = Array.isArray(data.result) ? data.result : [];

    return NextResponse.json({
      results,
      query,
      klant: klant || null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
