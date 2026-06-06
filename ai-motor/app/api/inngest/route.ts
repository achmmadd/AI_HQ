/**
 * Inngest serve handler — function discovery + execution (Sprint 2.2).
 * Graceful stub when INNGEST_* keys are unset.
 */

import { NextRequest, NextResponse } from "next/server";
import { serve } from "inngest/next";
import { inngest, isInngestConfigured } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

export const runtime = "nodejs";

const disabledResponse = () =>
  NextResponse.json({
    ok: true,
    configured: false,
    endpoint: "/api/inngest",
    message:
      "Inngest not configured — set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY, or INNGEST_DEV=1 for local dev server.",
  });

const inngestHandlers = isInngestConfigured()
  ? serve({
      client: inngest,
      functions: inngestFunctions,
    })
  : null;

export async function GET(req: NextRequest, context: unknown) {
  if (!inngestHandlers) return disabledResponse();
  return inngestHandlers.GET(req, context);
}

export async function POST(req: NextRequest, context: unknown) {
  if (!inngestHandlers) return disabledResponse();
  return inngestHandlers.POST(req, context);
}

export async function PUT(req: NextRequest, context: unknown) {
  if (!inngestHandlers) return disabledResponse();
  return inngestHandlers.PUT(req, context);
}
