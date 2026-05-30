import { NextRequest, NextResponse } from "next/server";
import { registerBridge } from "@/lib/bridge-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { device_name?: string; workspace_hint?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* leeg */
  }

  const device_name = body.device_name?.trim() || "pc-bridge";
  const { bridge_id, secret } = registerBridge({
    device_name,
    workspace_hint: body.workspace_hint?.trim(),
  });

  return NextResponse.json({
    ok: true,
    bridge_id,
    secret,
    poll_url: `/api/local-bridge/poll?bridge_id=${encodeURIComponent(bridge_id)}`,
    result_url: "/api/local-bridge/result",
    protocol_doc: "agent_service/docs/PC_BRIDGE.md",
  });
}
