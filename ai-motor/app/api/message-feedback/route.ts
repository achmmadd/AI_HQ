import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message_id: messageIdRaw,
      rating: ratingRaw,
      reason,
      klant = "fumero",
    } = body as {
      message_id?: number;
      rating?: number;
      reason?: string | null;
      klant?: string;
    };

    const messageId =
      typeof messageIdRaw === "number" && Number.isFinite(messageIdRaw)
        ? Math.floor(messageIdRaw)
        : NaN;
    const rating =
      typeof ratingRaw === "number" && Number.isFinite(ratingRaw)
        ? Math.round(ratingRaw)
        : NaN;

    if (!Number.isFinite(messageId) || messageId < 1) {
      return NextResponse.json({ error: "message_id required" }, { status: 400 });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "rating must be 1–5 (bijv. 1 = duim omlaag, 5 = duim omhoog)" },
        { status: 400 }
      );
    }

    const row = db
      .prepare(
        `SELECT id, klant, role FROM chat_history WHERE id = ?`
      )
      .get(messageId) as { id: number; klant: string; role: string } | undefined;

    if (!row || row.role !== "assistant") {
      return NextResponse.json({ error: "Bericht niet gevonden" }, { status: 404 });
    }
    if (row.klant !== klant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reasonStr =
      typeof reason === "string" && reason.trim()
        ? reason.trim().slice(0, 2000)
        : null;

    db.prepare(
      `INSERT INTO message_feedback (message_id, rating, reason, klant)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET
         rating = excluded.rating,
         reason = excluded.reason,
         klant = excluded.klant,
         created_at = datetime('now')`
    ).run(messageId, rating, reasonStr, row.klant);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
