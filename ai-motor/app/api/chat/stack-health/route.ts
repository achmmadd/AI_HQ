import { NextRequest, NextResponse } from "next/server";
import { runDependencyChecks } from "@/lib/dependency-checks";
import { buildPublicHealthPayload } from "@/lib/health-route-payload";
import { requireApiAuth } from "@/lib/require-api-auth";

export const runtime = "nodejs";

/** Stack-check voor ingelogd dashboard (auth via route guard). */
export async function GET(req: NextRequest) {
  const authErr = requireApiAuth(req);
  if (authErr) return authErr;
  const started = Date.now();
  const deps = await runDependencyChecks();
  const body = buildPublicHealthPayload(deps, Date.now() - started);
  return NextResponse.json(body, { status: body.ok ? 200 : 503 });
}
