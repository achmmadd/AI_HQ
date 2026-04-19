import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categorie = searchParams.get("categorie");
  let q = "SELECT * FROM bokas_menu WHERE actief = 1";
  const params: string[] = [];
  if (categorie) {
    q += " AND categorie = ?";
    params.push(categorie);
  }
  q += " ORDER BY categorie, naam";
  const menu = db.prepare(q).all(...params);
  return NextResponse.json({ menu });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    naam,
    categorie,
    prijs,
    beschrijving,
    vegan = false,
    gluten_vrij = false,
    week,
  } = body as Record<string, unknown>;

  if (!naam || !categorie) {
    return NextResponse.json(
      { error: "naam and categorie required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO bokas_menu
        (naam, categorie, prijs, beschrijving, vegan, gluten_vrij, week)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(naam),
      String(categorie),
      prijs != null ? Number(prijs) : null,
      beschrijving != null ? String(beschrijving) : null,
      vegan ? 1 : 0,
      gluten_vrij ? 1 : 0,
      week != null ? String(week) : null
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}
