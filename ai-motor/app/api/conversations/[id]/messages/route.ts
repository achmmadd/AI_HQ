import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const conversationId = Number(idStr);
  if (!Number.isFinite(conversationId) || conversationId < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || "fumero";

  const conv = db
    .prepare(`SELECT id, klant FROM conversations WHERE id = ?`)
    .get(conversationId) as { id: number; klant: string } | undefined;
  if (!conv || conv.klant !== klant) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const messages = db
    .prepare(
      `SELECT ch.id, ch.klant, ch.role, ch.content, ch.afdeling, ch.model, ch.created_at,
              ch.conversation_id, ch.experiment_id, ch.experiment_variant, ch.latency_ms,
              e.name AS experiment_name
       FROM chat_history ch
       LEFT JOIN experiments e ON e.id = ch.experiment_id
       WHERE ch.conversation_id = ?
       ORDER BY datetime(ch.created_at) ASC
       LIMIT 500`
    )
    .all(conversationId);

  return NextResponse.json({ messages });
}
