import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || "fumero";
  const rows = db
    .prepare(
      `SELECT id, klant, name, description, is_default
       FROM content_tone_presets
       WHERE klant = ?
       ORDER BY is_default DESC, name ASC`
    )
    .all(klant);
  return NextResponse.json({ presets: rows });
}
