import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

function nextStepIndex(runId: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(step_index), -1) AS m FROM agent_run_steps WHERE run_id = ?`
    )
    .get(runId) as { m: number };
  return row.m + 1;
}

/**
 * Externe worker / n8n mag agent-stappen pushen (geen shell-exec vanuit Next).
 * Header: x-agent-stream-secret == AGENT_STREAM_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AGENT_STREAM_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "AGENT_STREAM_SECRET niet geconfigureerd op server" },
      { status: 503 }
    );
  }

  const hdr = req.headers.get("x-agent-stream-secret")?.trim();
  if (hdr !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const runIdRaw = (body as { run_id?: unknown }).run_id;
  const runId =
    typeof runIdRaw === "number" && Number.isFinite(runIdRaw) ? runIdRaw : NaN;
  const label =
    typeof (body as { label?: string }).label === "string"
      ? (body as { label: string }).label.trim()
      : "";
  const detail =
    typeof (body as { detail?: string }).detail === "string"
      ? (body as { detail: string }).detail.trim()
      : null;
  const stepIndexOverride = (body as { step_index?: unknown }).step_index;

  if (!Number.isFinite(runId) || runId < 1 || !label) {
    return NextResponse.json(
      { error: "run_id (getal) en label (string) verplicht" },
      { status: 400 }
    );
  }

  const exists = db
    .prepare(`SELECT id FROM agent_api_runs WHERE id = ?`)
    .get(runId) as { id: number } | undefined;
  if (!exists) {
    return NextResponse.json({ error: "run niet gevonden" }, { status: 404 });
  }

  const stepIndex =
    typeof stepIndexOverride === "number" && Number.isFinite(stepIndexOverride)
      ? stepIndexOverride
      : nextStepIndex(runId);

  const ins = db
    .prepare(
      `INSERT INTO agent_run_steps (run_id, step_index, label, detail)
       VALUES (?, ?, ?, ?)`
    )
    .run(runId, stepIndex, label.slice(0, 500), detail);

  return NextResponse.json({
    ok: true,
    id: Number(ins.lastInsertRowid),
    run_id: runId,
    step_index: stepIndex,
  });
}
