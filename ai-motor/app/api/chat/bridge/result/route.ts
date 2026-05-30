import { NextRequest, NextResponse } from "next/server";
import { completeBridgeTask, verifyBridgeAuth } from "@/lib/bridge-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    bridge_id?: string;
    secret?: string;
    task_id?: number;
    ok?: boolean;
    result?: Record<string, unknown>;
  };

  const bridge_id = body.bridge_id?.trim() || "";
  const secret = body.secret?.trim() || "";
  const task_id = body.task_id;

  if (!bridge_id || !secret || !task_id) {
    return NextResponse.json(
      { error: "bridge_id, secret, task_id required" },
      { status: 400 }
    );
  }

  if (!verifyBridgeAuth(bridge_id, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  completeBridgeTask(
    task_id,
    bridge_id,
    body.result ?? {},
    body.ok !== false
  );

  return NextResponse.json({ ok: true });
}
