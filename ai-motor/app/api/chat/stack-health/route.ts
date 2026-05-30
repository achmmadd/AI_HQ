import { NextResponse } from "next/server";
import { runDependencyChecks } from "@/lib/dependency-checks";
import { buildPublicHealthPayload } from "@/lib/health-route-payload";

export const runtime = "nodejs";

/** Publiek via /api/chat/* — volledige stack-check voor dashboard. */
export async function GET() {
  const started = Date.now();
  const deps = await runDependencyChecks();
  const body = buildPublicHealthPayload(deps, Date.now() - started);
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
