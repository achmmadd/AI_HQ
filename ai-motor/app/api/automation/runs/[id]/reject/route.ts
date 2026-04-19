import { NextResponse } from "next/server";
import db from "@/lib/db/database";
import { rejectAutomationRun } from "@/lib/automation";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const ok = rejectAutomationRun(id);
  if (!ok) {
    return NextResponse.json(
      { error: "run not pending approval" },
      { status: 400 }
    );
  }

  const run = db
    .prepare(
      `SELECT r.*, t.title AS task_title, t.task_key
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE r.id = ?`
    )
    .get(id);

  return NextResponse.json({ run });
}
