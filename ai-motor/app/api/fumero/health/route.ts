import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { buildFumeroSystemStatus } from "@/lib/fumero/system-status";

export const runtime = "nodejs";

/** Workspace health for topbar and Command Center — real dependency checks. */
export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  try {
    const status = await buildFumeroSystemStatus();
    return NextResponse.json({
      ok: status.ok,
      label: status.label,
      level: status.level,
      checked_at: status.checked_at,
      checks: status.checks,
      automation_success_pct: status.automation_success_pct,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        label: "Storing",
        level: "down",
        error: message,
        checked_at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
