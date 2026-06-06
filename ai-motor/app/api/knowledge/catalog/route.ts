import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { qdrantSearchCollectionsForScope } from "@/lib/qdrant-collection";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";

export const runtime = "nodejs";

/**
 * SQLite-register van geïndexeerde documenten (Qdrant is vectorlaag).
 * Helps SSOT-discipline: zie wat er staat en wanneer het is toegevoegd.
 */
export async function GET(req: NextRequest) {
  const klant = req.nextUrl.searchParams.get("klant")?.trim().toLowerCase();
  if (klant !== "fumero" && klant !== "bokas") {
    return NextResponse.json(
      { error: "klant=fumero|bokas vereist" },
      { status: 400 }
    );
  }

  const auth = await requireApiAuthForKlant(req, klant);
  if (auth instanceof NextResponse) return auth;

  try {
    ensurePlatformSchema();
    const cols = db
      .prepare(`PRAGMA table_info(knowledge_documents)`)
      .all() as { name: string }[];
    const hasCanonical = cols.some((c) => c.name === "canonical_source");

    const rows = hasCanonical
      ? (db
          .prepare(
            `SELECT id, klant, filename, category, chunk_count, content_sha256,
                    canonical_source, created_at
             FROM knowledge_documents
             WHERE klant = ?
             ORDER BY datetime(created_at) DESC
             LIMIT 500`
          )
          .all(klant) as {
          id: number;
          klant: string;
          filename: string;
          category: string | null;
          chunk_count: number;
          content_sha256: string;
          canonical_source: string | null;
          created_at: string;
        }[])
      : (db
          .prepare(
            `SELECT id, klant, filename, category, chunk_count, content_sha256,
                    created_at
             FROM knowledge_documents
             WHERE klant = ?
             ORDER BY datetime(created_at) DESC
             LIMIT 500`
          )
          .all(klant) as {
          id: number;
          klant: string;
          filename: string;
          category: string | null;
          chunk_count: number;
          content_sha256: string;
          created_at: string;
        }[]).map((r) => ({
          ...r,
          canonical_source: null as string | null,
        }));

    return NextResponse.json({
      klant,
      qdrant_collections: qdrantSearchCollectionsForScope(klant),
      documents: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        category: r.category,
        chunk_count: r.chunk_count,
        content_sha256_short: r.content_sha256.slice(0, 12),
        canonical_source: r.canonical_source ?? null,
        created_at: r.created_at,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
