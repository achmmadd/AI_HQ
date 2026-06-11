import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

/**
 * Stripe webhook stub — logt events; geen productie-facturatie (Fase 6).
 * Configureer STRIPE_WEBHOOK_SECRET voor signature-verificatie later.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType =
    typeof payload.type === "string" ? payload.type : "unknown";

  logAudit({
    actor: "stripe_webhook",
    action: `stripe.${eventType}`,
    resource: "billing",
    detail: { received: true, stub: true },
  });

  return NextResponse.json({ received: true, stub: true, type: eventType });
}
