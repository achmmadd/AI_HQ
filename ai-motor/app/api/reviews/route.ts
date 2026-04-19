import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get("status");
  let q = "SELECT * FROM fumero_reviews WHERE 1=1";
  const params: string[] = [];
  if (status) {
    q += " AND status = ?";
    params.push(status);
  }
  q += " ORDER BY datetime(created_at) DESC LIMIT 100";
  const reviews = db.prepare(q).all(...params);
  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    external_id,
    reviewer_name,
    rating,
    review_text,
    source = "google",
  } = body as Record<string, unknown>;

  if (!review_text || typeof review_text !== "string") {
    return NextResponse.json(
      { error: "review_text required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO fumero_reviews
        (external_id, source, reviewer_name, rating, review_text)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      external_id != null ? String(external_id) : null,
      String(source),
      reviewer_name != null ? String(reviewer_name) : null,
      rating != null ? Number(rating) : null,
      review_text
    );

  return NextResponse.json({
    id: result.lastInsertRowid,
    message: "Review opgeslagen",
  });
}
