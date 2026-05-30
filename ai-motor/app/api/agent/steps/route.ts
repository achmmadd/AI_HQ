import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const runIdRaw = new URL(req.url).searchParams.get("run_id");
  const runId = runIdRaw ? Number(runIdRaw) : NaN;
  if (!Number.isFinite(runId) || runId < 1) {
    return NextResponse.json({ error: "run_id verplicht" }, { status: 400 });
  }

  const steps = db
    .prepare(
      `SELECT id, run_id, step_index, label, detail, created_at
       FROM agent_run_steps WHERE run_id = ?
       ORDER BY step_index ASC, id ASC`
    )
    .all(runId);

  return NextResponse.json({ run_id: runId, steps });
}
