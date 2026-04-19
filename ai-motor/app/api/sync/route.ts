import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, data, source = "factory-os" } = body as {
    type?: string;
    data?: Record<string, unknown>;
    source?: string;
  };

  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "data required" }, { status: 400 });
  }

  if (type === "todo") {
    const title = String(data.title ?? "");
    if (!title) {
      return NextResponse.json({ error: "data.title required" }, { status: 400 });
    }
    const result = db
      .prepare(
        `INSERT INTO todos
          (title, description, klant, afdeling, priority, due_date, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        data.description != null ? String(data.description) : null,
        data.klant != null ? String(data.klant) : "algemeen",
        data.afdeling != null ? String(data.afdeling) : null,
        data.priority != null ? String(data.priority) : "normaal",
        data.due_date != null ? String(data.due_date) : null,
        source
      );

    void sendTelegramMessage(
      `📋 Factory OS — nieuwe taak\n${title}\nBedrijf: ${String(data.klant ?? "algemeen")}\nPrioriteit: ${String(data.priority ?? "normaal")}`
    );

    return NextResponse.json({
      id: result.lastInsertRowid,
      type: "todo",
      message: "Taak aangemaakt vanuit Factory OS",
    });
  }

  if (type === "agenda") {
    const title = String(data.title ?? "");
    const start_time = String(data.start_time ?? "");
    if (!title || !start_time) {
      return NextResponse.json(
        { error: "data.title and data.start_time required" },
        { status: 400 }
      );
    }
    const result = db
      .prepare(
        `INSERT INTO agenda
          (title, description, klant, start_time, end_time, all_day, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        data.description != null ? String(data.description) : null,
        data.klant != null ? String(data.klant) : "algemeen",
        start_time,
        data.end_time != null ? String(data.end_time) : null,
        data.all_day ? 1 : 0,
        source
      );

    void sendTelegramMessage(
      `📅 Factory OS — afspraak\n${title}\nWanneer: ${start_time}`
    );

    return NextResponse.json({
      id: result.lastInsertRowid,
      type: "agenda",
      message: "Event aangemaakt vanuit Factory OS",
    });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
