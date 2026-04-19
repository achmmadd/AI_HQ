import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klant = new URL(req.url).searchParams.get("klant") || "fumero";
  const templates = db
    .prepare(
      "SELECT * FROM content_templates WHERE klant = ? AND actief = 1 ORDER BY platform, naam"
    )
    .all(klant);
  return NextResponse.json({ templates });
}
