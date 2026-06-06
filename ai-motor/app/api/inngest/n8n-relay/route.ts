/**
 * Thin n8n → Inngest webhook relay (optional).
 * n8n HTTP Request node can POST here to start durable Motor workflows.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  forwardInngestToN8n,
  relayN8nWebhookToInngest,
  resolveN8nBridgeWebhookUrl,
} from "@/lib/inngest/n8n-bridge";
import { isInngestConfigured } from "@/lib/inngest/client";

export const runtime = "nodejs";

function verifyRelaySecret(req: NextRequest): boolean {
  const expected = process.env.INNGEST_N8N_RELAY_SECRET?.trim();
  if (!expected) return true;
  const header = req.headers.get("x-inngest-relay-secret")?.trim();
  const auth = req.headers.get("authorization")?.trim();
  if (header === expected) return true;
  if (auth === `Bearer ${expected}`) return true;
  return false;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    relay: "motor/inngest/n8n-relay",
    inngest_configured: isInngestConfigured(),
    n8n_webhook_resolved: Boolean(resolveN8nBridgeWebhookUrl()),
    secret_required: Boolean(process.env.INNGEST_N8N_RELAY_SECRET?.trim()),
  });
}

export async function POST(req: NextRequest) {
  if (!verifyRelaySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = typeof body.mode === "string" ? body.mode : "to-inngest";
  const result: Record<string, unknown> = {};

  if (mode === "to-inngest" || mode === "both") {
    result.inngest = await relayN8nWebhookToInngest(body);
  }

  if (mode === "to-n8n" || mode === "both") {
    const url =
      typeof body.n8nWebhookUrl === "string"
        ? body.n8nWebhookUrl
        : resolveN8nBridgeWebhookUrl();

    if (!url) {
      result.n8n = { ok: false, error: "no n8n webhook configured" };
    } else {
      const payload =
        body.payload && typeof body.payload === "object"
          ? (body.payload as Record<string, unknown>)
          : body;
      result.n8n = await forwardInngestToN8n(url, payload);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
