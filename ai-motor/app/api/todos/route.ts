import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const klant = searchParams.get("klant");
  const status = searchParams.get("status");

  let query = `SELECT * FROM todos WHERE 1=1`;
  const params: (string | number)[] = [];

  if (klant) {
    query += " AND klant = ?";
    params.push(klant);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  query += ` ORDER BY
    CASE priority
      WHEN 'kritiek' THEN 1
      WHEN 'hoog' THEN 2
      WHEN 'normaal' THEN 3
      ELSE 4
    END,
    datetime(created_at) DESC`;

  const todos = db.prepare(query).all(...params);
  return NextResponse.json({ todos });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title,
    description,
    klant = "algemeen",
    afdeling,
    priority = "normaal",
    due_date,
    source = "handmatig",
  } = body as Record<string, string | undefined>;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const result = db
    .prepare(
      `INSERT INTO todos
        (title, description, klant, afdeling, priority, due_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      description ?? null,
      klant,
      afdeling ?? null,
      priority,
      due_date ?? null,
      source
    );

  if (priority === "hoog" || priority === "kritiek") {
    void sendTelegramMessage(
      `📋 Nieuwe hoge prioriteit taak:\n${title}\nKlant: ${klant}`
    );
  }

  return NextResponse.json({
    id: result.lastInsertRowid,
    message: "Todo aangemaakt",
  });
}
