import { NextRequest, NextResponse } from "next/server";
import { pollBridgeTask, verifyBridgeAuth } from "@/lib/bridge-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const bridge_id = req.nextUrl.searchParams.get("bridge_id")?.trim() || "";
  const secret =
    req.headers.get("x-bridge-secret")?.trim() ||
    req.nextUrl.searchParams.get("secret")?.trim() ||
    "";

  if (!bridge_id || !secret) {
    return NextResponse.json(
      { error: "bridge_id and secret required" },
      { status: 400 }
    );
  }

  if (!verifyBridgeAuth(bridge_id, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const task = pollBridgeTask(bridge_id);
  if (!task) {
    return NextResponse.json({ ok: true, task: null });
  }

  return NextResponse.json({
    ok: true,
    task: { task_id: task.task_id, payload: task.payload },
  });
}
