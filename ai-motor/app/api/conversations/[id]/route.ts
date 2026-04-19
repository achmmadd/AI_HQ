import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || null;
  const row = db
    .prepare(`SELECT id, klant FROM conversations WHERE id = ?`)
    .get(id) as { id: number; klant: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (klant && row.klant !== klant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  db.prepare(`DELETE FROM chat_history WHERE conversation_id = ?`).run(id);
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);

  return NextResponse.json({ ok: true });
}
