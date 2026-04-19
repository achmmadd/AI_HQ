import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klant =
    new URL(req.url).searchParams.get("klant") || "fumero";
  const messages = db
    .prepare(
      `SELECT id, klant, role, content, afdeling, model, created_at
       FROM chat_history
       WHERE klant = ?
       ORDER BY datetime(created_at) ASC
       LIMIT 100`
    )
    .all(klant);

  return NextResponse.json({ messages });
}

export async function DELETE(req: NextRequest) {
  const klant = new URL(req.url).searchParams.get("klant");
  if (klant) {
    db.prepare("DELETE FROM chat_history WHERE klant = ?").run(klant);
  }
  return NextResponse.json({ ok: true });
}
