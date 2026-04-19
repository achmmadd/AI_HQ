import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const klant = searchParams.get("klant");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = "SELECT * FROM agenda WHERE 1=1";
  const params: string[] = [];

  if (klant) {
    query += " AND klant = ?";
    params.push(klant);
  }
  if (from) {
    query += " AND start_time >= ?";
    params.push(from);
  }
  if (to) {
    query += " AND start_time <= ?";
    params.push(to);
  }
  query += " ORDER BY datetime(start_time) ASC";

  const events = db.prepare(query).all(...params);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title,
    description,
    klant = "algemeen",
    start_time,
    end_time,
    all_day = false,
    source = "handmatig",
    todo_id,
  } = body as Record<string, unknown>;

  if (!title || typeof title !== "string" || !start_time || typeof start_time !== "string") {
    return NextResponse.json(
      { error: "title and start_time required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO agenda
        (title, description, klant, start_time, end_time, all_day, source, todo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      typeof description === "string" ? description : null,
      klant,
      start_time,
      typeof end_time === "string" ? end_time : null,
      all_day ? 1 : 0,
      typeof source === "string" ? source : "handmatig",
      typeof todo_id === "number" ? todo_id : null
    );

  const src = typeof source === "string" ? source : "handmatig";
  if (src === "factory-os") {
    void sendTelegramMessage(
      `📅 Factory OS heeft een afspraak gepland\n${String(title)}\nWanneer: ${String(start_time)}`
    );
  }

  return NextResponse.json({
    id: result.lastInsertRowid,
    message: "Event aangemaakt",
  });
}
