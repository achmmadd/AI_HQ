import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET() {
  const personeel = db
    .prepare("SELECT * FROM bokas_personeel WHERE actief = 1 ORDER BY naam")
    .all();
  return NextResponse.json({ personeel });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { naam, rol, telefoon, email } = body as Record<string, unknown>;
  if (!naam || !rol) {
    return NextResponse.json(
      { error: "naam and rol required" },
      { status: 400 }
    );
  }
  const result = db
    .prepare(
      `INSERT INTO bokas_personeel (naam, rol, telefoon, email)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      String(naam),
      String(rol),
      telefoon != null ? String(telefoon) : null,
      email != null ? String(email) : null
    );
  return NextResponse.json({ id: result.lastInsertRowid });
}
