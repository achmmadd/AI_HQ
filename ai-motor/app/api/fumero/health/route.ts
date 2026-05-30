import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

/** Lightweight workspace health for topbar (not /api/chat). */
export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  try {
    await ensureFumeroSchemaAsync();
    return NextResponse.json({
      ok: true,
      label: "Studio OK",
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, label: "Sync issue", error: message },
      { status: 503 }
    );
  }
}
