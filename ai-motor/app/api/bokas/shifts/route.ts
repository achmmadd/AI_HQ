import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

/** Shifts met optioneel filter op datumbereik */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const datum = searchParams.get("datum");

  let q = `
    SELECT s.*, p.naam AS personeel_naam, p.rol AS personeel_rol
    FROM bokas_shifts s
    LEFT JOIN bokas_personeel p ON p.id = s.personeels_id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (datum) {
    q += " AND s.datum = ?";
    params.push(datum);
  } else {
    if (from) {
      q += " AND s.datum >= ?";
      params.push(from);
    }
    if (to) {
      q += " AND s.datum <= ?";
      params.push(to);
    }
  }

  q += " ORDER BY s.datum ASC, s.start_tijd ASC";

  const shifts = db.prepare(q).all(...params);
  return NextResponse.json({ shifts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    personeels_id,
    datum,
    start_tijd,
    eind_tijd,
    rol,
    status = "gepland",
  } = body as Record<string, unknown>;

  if (
    personeels_id == null ||
    !datum ||
    !start_tijd ||
    !eind_tijd
  ) {
    return NextResponse.json(
      { error: "personeels_id, datum, start_tijd, eind_tijd required" },
      { status: 400 }
    );
  }

  const pid = Number(personeels_id);
  if (Number.isNaN(pid)) {
    return NextResponse.json({ error: "invalid personeels_id" }, { status: 400 });
  }

  const exists = db
    .prepare("SELECT 1 FROM bokas_personeel WHERE id = ? AND actief = 1")
    .get(pid);
  if (!exists) {
    return NextResponse.json(
      { error: "personeel not found or inactive" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO bokas_shifts
        (personeels_id, datum, start_tijd, eind_tijd, rol, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      pid,
      String(datum),
      String(start_tijd),
      String(eind_tijd),
      rol != null ? String(rol) : null,
      String(status)
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}
