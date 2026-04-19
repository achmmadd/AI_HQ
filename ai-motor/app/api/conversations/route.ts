import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || "fumero";
  const rows = db
    .prepare(
      `SELECT id, klant, title, created_at, updated_at
       FROM conversations
       WHERE klant = ?
       ORDER BY datetime(updated_at) DESC
       LIMIT 100`
    )
    .all(klant);

  return NextResponse.json({ conversations: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const klant =
    typeof body?.klant === "string" && body.klant.trim()
      ? body.klant.trim()
      : "fumero";
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Nieuwe chat";

  const r = db
    .prepare(
      `INSERT INTO conversations (klant, title) VALUES (?, ?)`
    )
    .run(klant, title);

  const id = Number(r.lastInsertRowid);
  const row = db
    .prepare(
      `SELECT id, klant, title, created_at, updated_at FROM conversations WHERE id = ?`
    )
    .get(id);

  return NextResponse.json(row);
}
