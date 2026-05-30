import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/cron-secret";
import { runAutomationCronTickExtended } from "@/lib/automation-cron-extended";

export const runtime = "nodejs";

/**
 * Plan + voer due automation-taken uit (of zet op pending_approval).
 * Roep elke ~5–15 min aan met header `x-cron-secret` (FEEDBACK_CRON_SECRET).
 */
export async function POST(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const result = await runAutomationCronTickExtended(new Date());
  return NextResponse.json(result);
}
