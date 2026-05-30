import { NextRequest, NextResponse } from "next/server";
import { registerBridge } from "@/lib/bridge-service";

export const runtime = "nodejs";

function verifyRegisterSecret(req: NextRequest, body: { register_secret?: string }): boolean {
  const expected = process.env.BRIDGE_REGISTER_SECRET?.trim();
  if (!expected) return true;

  const header =
    req.headers.get("x-bridge-register-secret")?.trim() ||
    body.register_secret?.trim() ||
    "";
  return header === expected;
}

/** PC bridge register (public via /api/chat/* middleware). */
export async function POST(req: NextRequest) {
  let body: { device_name?: string; workspace_hint?: string; register_secret?: string } =
    {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* leeg */
  }

  if (!verifyRegisterSecret(req, body)) {
    return NextResponse.json({ error: "register_secret_required" }, { status: 401 });
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
    poll_path: `/api/chat/bridge/poll?bridge_id=${encodeURIComponent(bridge_id)}`,
    result_path: "/api/chat/bridge/result",
  });
}
