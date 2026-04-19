import { NextRequest, NextResponse } from "next/server";

const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const QDRANT = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const COLLECTION = process.env.QDRANT_COLLECTION || "factory_os";

async function embed(text: string): Promise<number[]> {
  const r = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`Ollama embed ${r.status}`);
  const j = (await r.json()) as { embedding?: number[] };
  if (!j.embedding?.length) throw new Error("No embedding");
  return j.embedding;
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
    const vector = await embed(query);
    const filter =
      klant && ["fumero", "bokas"].includes(klant)
        ? {
            filter: {
              must: [{ key: "client", match: { value: klant } }],
            },
          }
        : {};

    const r = await fetch(
      `${QDRANT}/collections/${COLLECTION}/points/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vector,
          limit: Math.min(Number(limit) || 10, 50),
          with_payload: true,
          ...filter,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );
    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { error: text || r.statusText },
        { status: r.status }
      );
    }
    return NextResponse.json(JSON.parse(text));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "search failed" },
      { status: 502 }
    );
  }
}
