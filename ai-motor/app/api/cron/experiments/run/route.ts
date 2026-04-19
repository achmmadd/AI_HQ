import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/cron-secret";
import {
  finalizeExperiment,
  listExperimentsDueForClosing,
  seedAutoExperimentIfIdle,
} from "@/lib/experiments";

export const runtime = "nodejs";

/**
 * Wekelijks (of vaker) vanuit n8n:
 * 1) Sluit verlopen actieve experimenten af (winnaar → learned suffix + Telegram)
 * 2) Start desgewenst een auto-experiment als er geen actief is
 *
 * Header: x-cron-secret — zie FEEDBACK_CRON_SECRET
 * Body JSON optioneel: { "seed_if_idle": true } (default true)
 */
export async function POST(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const body = await req.json().catch(() => ({}));
  const seedIfIdle = (body as { seed_if_idle?: boolean }).seed_if_idle !== false;

  const due = listExperimentsDueForClosing();
  const results: unknown[] = [];
  for (const expId of due) {
    results.push(finalizeExperiment(expId));
  }

  let seeded: number | null = null;
  if (seedIfIdle) {
    seeded = seedAutoExperimentIfIdle();
  }

  return NextResponse.json({
    closed: due.length,
    results,
    seeded_id: seeded,
  });
}
