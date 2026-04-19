import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { callReviewN8n, extractMessage } from "@/lib/chat-n8n";

export const runtime = "nodejs";

type ReviewRow = {
  id: number;
  reviewer_name: string | null;
  rating: number | null;
  review_text: string;
};

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT * FROM fumero_reviews WHERE id = ?")
    .get(id) as ReviewRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { ok, status, data, rawText } = await callReviewN8n({
    type: "review_reply",
    klant: "fumero",
    review: {
      reviewer_name: row.reviewer_name,
      rating: row.rating,
      text: row.review_text,
    },
  });

  if (!ok) {
    return NextResponse.json(
      {
        error: `n8n error: ${status}`,
        detail: rawText.slice(0, 500),
      },
      { status: 502 }
    );
  }

  const suggested = extractMessage(data);

  db.prepare(
    `UPDATE fumero_reviews
     SET suggested_reply = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(suggested, id);

  return NextResponse.json({ suggested_reply: suggested });
}
