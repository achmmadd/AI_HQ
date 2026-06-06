import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const klant = url.searchParams.get("klant") || "fumero";
  const auth = await requireApiAuthForKlant(req, klant);
  if (auth instanceof Response) return auth;
  const convRaw = url.searchParams.get("conversation_id");

  let messages: unknown[];
  if (convRaw != null && convRaw !== "") {
    const conversationId = Number(convRaw);
    if (!Number.isFinite(conversationId)) {
      return NextResponse.json(
        { error: "invalid conversation_id" },
        { status: 400 }
      );
    }
    messages = db
      .prepare(
        `SELECT ch.id, ch.klant, ch.role, ch.content, ch.afdeling, ch.model, ch.created_at,
                ch.conversation_id, ch.experiment_id, ch.experiment_variant, ch.latency_ms,
                e.name AS experiment_name
         FROM chat_history ch
         LEFT JOIN experiments e ON e.id = ch.experiment_id
         WHERE ch.klant = ? AND ch.conversation_id = ?
         ORDER BY datetime(ch.created_at) ASC
         LIMIT 500`
      )
      .all(klant, conversationId);
  } else {
    messages = db
      .prepare(
        `SELECT ch.id, ch.klant, ch.role, ch.content, ch.afdeling, ch.model, ch.created_at,
                ch.conversation_id, ch.experiment_id, ch.experiment_variant, ch.latency_ms,
                e.name AS experiment_name
         FROM chat_history ch
         LEFT JOIN experiments e ON e.id = ch.experiment_id
         WHERE ch.klant = ? AND ch.conversation_id IS NULL
         ORDER BY datetime(ch.created_at) ASC
         LIMIT 100`
      )
      .all(klant);
  }

  return NextResponse.json({ messages });
}

export async function DELETE(req: NextRequest) {
  const klant = new URL(req.url).searchParams.get("klant");
  if (!klant) {
    return NextResponse.json({ error: "klant is required" }, { status: 400 });
  }
  const auth = await requireApiAuthForKlant(req, klant);
  if (auth instanceof Response) return auth;
  db.prepare("DELETE FROM chat_history WHERE klant = ?").run(klant);
  return NextResponse.json({ ok: true });
}
