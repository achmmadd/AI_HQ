import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge-service";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";

export const runtime = "nodejs";

/** Dual-search endpoint (rewrite target for legacy /api/qdrant/search). */
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

    const klantNorm = (klant || "").trim().toLowerCase() || "fumero";
    const auth = await requireApiAuthForKlant(req, klantNorm);
    if (auth instanceof NextResponse) return auth;

    const cap = Math.min(Number(limit) || 10, 50);
    const { results, error, collections } = await searchKnowledge(query, {
      klant,
      limit: cap,
    });

    if (error && results.length === 0) {
      return NextResponse.json({ error }, { status: 502 });
    }

    return NextResponse.json({
      results,
      query,
      klant: klant || null,
      collections: collections ?? [],
      ...(error ? { warning: error } : {}),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
