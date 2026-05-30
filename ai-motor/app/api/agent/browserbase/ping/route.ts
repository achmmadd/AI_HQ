import { NextResponse } from "next/server";
import {
  isBrowserbaseConfigured,
  browserbasePing,
} from "@/lib/browserbase-client";

export const runtime = "nodejs";

/** Valideert BROWSERBASE_API_KEY tegen Browserbase (`GET /v1/sessions?limit=1`). */
export async function GET() {
  if (!isBrowserbaseConfigured()) {
    return NextResponse.json(
      {
        error: "browserbase_not_configured",
        detail: "Zet BROWSERBASE_API_KEY en herstart Motor.",
      },
      { status: 400 }
    );
  }
  const r = await browserbasePing();
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
