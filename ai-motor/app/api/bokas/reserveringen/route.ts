import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const datum = searchParams.get("datum");
  let q = "SELECT * FROM bokas_reserveringen WHERE 1=1";
  const params: string[] = [];
  if (datum) {
    q += " AND datum = ?";
    params.push(datum);
  }
  q += " ORDER BY datum ASC, tijd ASC";
  const reserveringen = db.prepare(q).all(...params);
  return NextResponse.json({ reserveringen });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    naam,
    email,
    telefoon,
    datum,
    tijd,
    personen,
    opmerkingen,
    source = "handmatig",
  } = body as Record<string, unknown>;

  if (
    !naam ||
    !datum ||
    !tijd ||
    personen == null ||
    typeof personen !== "number"
  ) {
    return NextResponse.json(
      { error: "naam, datum, tijd, personen required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO bokas_reserveringen
        (naam, email, telefoon, datum, tijd, personen, opmerkingen, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(naam),
      email != null ? String(email) : null,
      telefoon != null ? String(telefoon) : null,
      String(datum),
      String(tijd),
      personen,
      opmerkingen != null ? String(opmerkingen) : null,
      String(source)
    );

  void sendTelegramMessage(
    `🍽️ Nieuwe Bokas reservering\n${String(naam)} · ${personen} personen\n${String(datum)} om ${String(tijd)}${opmerkingen != null ? `\n${String(opmerkingen)}` : ""}`
  );

  return NextResponse.json({
    id: result.lastInsertRowid,
    message: "Reservering aangemaakt",
  });
}
