import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { archiveAllActiveExperiments } from "@/lib/experiments";

export const runtime = "nodejs";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT id, name, hypothesis, variant_a, variant_b, status, klant,
              winner_variant, created_at, ends_at, closed_at, summary_json, updated_at
       FROM experiments
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();
  return NextResponse.json({ experiments: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    name,
    hypothesis = "",
    variant_a,
    variant_b,
    klant = null as string | null,
    ends_in_days: endsInDaysRaw = 7,
  } = body as {
    name?: string;
    hypothesis?: string;
    variant_a?: string;
    variant_b?: string;
    klant?: string | null;
    ends_in_days?: number;
  };

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof variant_a !== "string" ||
    !variant_a.trim() ||
    typeof variant_b !== "string" ||
    !variant_b.trim()
  ) {
    return NextResponse.json(
      { error: "name, variant_a, variant_b verplicht" },
      { status: 400 }
    );
  }

  const endsInDays =
    typeof endsInDaysRaw === "number" && Number.isFinite(endsInDaysRaw)
      ? Math.min(90, Math.max(1, Math.floor(endsInDaysRaw)))
      : 7;
  const offset = `+${endsInDays} days`;

  archiveAllActiveExperiments();

  const r = db
    .prepare(
      `INSERT INTO experiments (name, hypothesis, variant_a, variant_b, status, klant, ends_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, datetime('now', ?), datetime('now'))`
    )
    .run(
      name.trim(),
      typeof hypothesis === "string" ? hypothesis.trim() : "",
      variant_a.trim(),
      variant_b.trim(),
      typeof klant === "string" && klant.trim() ? klant.trim() : null,
      offset
    );

  const id = Number(r.lastInsertRowid);
  const row = db
    .prepare(
      `SELECT id, name, hypothesis, variant_a, variant_b, status, klant,
              winner_variant, created_at, ends_at, closed_at, summary_json, updated_at
       FROM experiments WHERE id = ?`
    )
    .get(id);

  return NextResponse.json(row);
}
