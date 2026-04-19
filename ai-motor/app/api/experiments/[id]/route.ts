import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { finalizeExperiment } from "@/lib/experiments";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action?.trim();

  if (action === "archive") {
    db.prepare(
      `UPDATE experiments
       SET status = 'archived',
           closed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ? AND status = 'active'`
    ).run(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "finalize") {
    const result = finalizeExperiment(id);
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "action must be archive | finalize" },
    { status: 400 }
  );
}
