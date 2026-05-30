import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const klant = "fumero";
  const templates = db
    .prepare(
      "SELECT * FROM content_templates WHERE klant = ? AND actief = 1 ORDER BY platform, naam"
    )
    .all(klant);
  return NextResponse.json({ templates });
}
