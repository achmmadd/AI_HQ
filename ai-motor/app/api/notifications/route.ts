import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unread = searchParams.get("unread");

  let query = "SELECT * FROM notifications WHERE 1=1";
  if (unread === "true") query += " AND read = 0";
  query += " ORDER BY datetime(created_at) DESC LIMIT 50";

  const notifications = db.prepare(query).all();
  const unreadRow = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0")
    .get() as { count: number };

  return NextResponse.json({
    notifications,
    unread_count: unreadRow.count,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    type,
    title,
    message,
    klant,
    priority = "normaal",
    send_telegram = false,
  } = body as Record<string, unknown>;

  if (!type || !title) {
    return NextResponse.json(
      { error: "type and title required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO notifications
        (type, title, message, klant, priority)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      String(type),
      String(title),
      message != null ? String(message) : null,
      klant != null ? String(klant) : null,
      String(priority)
    );

  const id = result.lastInsertRowid as number;
  const pri = String(priority);

  if (send_telegram || pri === "hoog" || pri === "kritiek") {
    const emoji =
      pri === "kritiek" ? "🚨" : pri === "hoog" ? "⚠️" : "ℹ️";
    void sendTelegramMessage(
      `${emoji} ${String(title)}\n${message != null ? String(message) : ""}`
    );
    db.prepare("UPDATE notifications SET telegram_sent = 1 WHERE id = ?").run(
      id
    );
  }

  return NextResponse.json({
    id,
    message: "Notificatie aangemaakt",
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, all } = body as { id?: number; all?: boolean };

  if (all) {
    db.prepare("UPDATE notifications SET read = 1").run();
  } else if (id != null) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
  }

  return NextResponse.json({ message: "Bijgewerkt" });
}
