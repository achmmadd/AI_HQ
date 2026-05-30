import { NextRequest, NextResponse } from "next/server";
import {
  chunkKnowledgeText,
  clampChunkSize,
  type ChunkStrategy,
} from "@/lib/knowledge-chunk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = typeof body?.text === "string" ? body.text : "";
  const strategy = (body?.strategy as ChunkStrategy) || "paragraph";
  const maxChunkChars = clampChunkSize(
    Number(body?.max_chunk_chars) || (strategy === "fixed" ? 800 : 1200),
    200,
    4000
  );

  if (!text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const chunks = chunkKnowledgeText(text, strategy, maxChunkChars);

  return NextResponse.json({
    strategy,
    max_chunk_chars: maxChunkChars,
    chunk_count: chunks.length,
    chunks,
  });
}
