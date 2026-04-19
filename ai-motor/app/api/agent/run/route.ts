import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  executeAutomationTask,
  getAutomationTaskByKey,
} from "@/lib/automation";
import {
  listAgentTaskKeys,
  resolveAgentTaskKey,
} from "@/lib/agent-resolve";

export const runtime = "nodejs";

export async function GET() {
  const runs = db
    .prepare(
      `SELECT id, task_key, automation_task_id, input_prompt, status, detail,
              error_message, created_at, finished_at
       FROM agent_api_runs
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();
  const task_keys = listAgentTaskKeys();
  return NextResponse.json({ runs, task_keys });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const taskKeyRaw = (body as { task_key?: string }).task_key;
  const taskPrompt = (body as { task?: string }).task;
  const prompt =
    typeof taskPrompt === "string"
      ? taskPrompt
      : typeof (body as { prompt?: string }).prompt === "string"
        ? (body as { prompt: string }).prompt
        : "";

  const explicit =
    typeof taskKeyRaw === "string" && taskKeyRaw.trim() ? taskKeyRaw.trim() : null;

  const taskKey = resolveAgentTaskKey(prompt, explicit);
  if (!taskKey) {
    return NextResponse.json(
      {
        error:
          "Geen automation-taak herkend. Geef task_key of een prompt met o.a. orders, factuur, voorraad, social, rapport.",
        task_keys: listAgentTaskKeys(),
      },
      { status: 400 }
    );
  }

  const taskRow = getAutomationTaskByKey(taskKey);
  if (!taskRow) {
    return NextResponse.json({ error: "Task niet gevonden" }, { status: 404 });
  }

  const ins = db
    .prepare(
      `INSERT INTO agent_api_runs (task_key, automation_task_id, input_prompt, status)
       VALUES (?, ?, ?, 'running')`
    )
    .run(taskKey, taskRow.id, prompt.trim() || explicit || null);

  const runId = Number(ins.lastInsertRowid);

  try {
    const result = await executeAutomationTask(taskRow);
    db.prepare(
      `UPDATE agent_api_runs
       SET status = ?, detail = ?, error_message = NULL, finished_at = datetime('now')
       WHERE id = ?`
    ).run(result.ok ? "success" : "failed", result.detail, runId);

    return NextResponse.json({
      run_id: runId,
      task_key: taskKey,
      success: result.ok,
      detail: result.detail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.prepare(
      `UPDATE agent_api_runs
       SET status = 'failed', error_message = ?, finished_at = datetime('now')
       WHERE id = ?`
    ).run(msg, runId);
    return NextResponse.json(
      { run_id: runId, task_key: taskKey, success: false, error: msg },
      { status: 500 }
    );
  }
}
