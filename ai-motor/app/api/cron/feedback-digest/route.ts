import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { assertCronSecret } from "@/lib/cron-secret";

export const runtime = "nodejs";

/**
 * n8n nightly — stap A/B: negatieve feedback van een dag, gegroepeerd per `reason`.
 * GET …/api/cron/feedback-digest?date=2026-04-19
 * Header: x-cron-secret (of ?secret=), zie FEEDBACK_CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const url = new URL(req.url);
  const date =
    url.searchParams.get("date")?.trim() ||
    new Date().toISOString().slice(0, 10);

  const negative = db
    .prepare(
      `SELECT mf.message_id, mf.rating, mf.reason, mf.klant, mf.created_at,
              substr(ch.content, 1, 400) as content_preview
       FROM message_feedback mf
       JOIN chat_history ch ON ch.id = mf.message_id
       WHERE date(mf.created_at) = date(?)
         AND mf.rating <= 2
       ORDER BY mf.created_at ASC`
    )
    .all(date) as Array<{
      message_id: number;
      rating: number;
      reason: string | null;
      klant: string;
      created_at: string;
      content_preview: string;
    }>;

  const byReason: Record<string, number> = {};
  for (const r of negative) {
    const key = r.reason?.trim() || "(geen reden)";
    byReason[key] = (byReason[key] ?? 0) + 1;
  }

  return NextResponse.json({
    date,
    negative_count: negative.length,
    by_reason: byReason,
    negative,
  });
}
