import { NextRequest, NextResponse } from "next/server";
import { listBridges, revokeBridge } from "@/lib/bridge-service";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function GET() {
  const bridges = listBridges();
  return NextResponse.json({ bridges });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bridge_id = (body as { bridge_id?: string }).bridge_id?.trim();

  if (!bridge_id) {
    return NextResponse.json(
      { error: "bridge_id verplicht" },
      { status: 400 }
    );
  }

  const ok = revokeBridge(bridge_id);
  if (!ok) {
    return NextResponse.json({ error: "bridge niet gevonden" }, { status: 404 });
  }

  logAudit({
    action: "pc_bridge.revoke",
    resource: `pc_bridges/${bridge_id}`,
    detail: { bridge_id },
  });

  return NextResponse.json({ ok: true, bridge_id });
}
