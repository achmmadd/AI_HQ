import db from "@/lib/db/database";
import {
  enqueueBridgeTask,
  listBridges,
  type BridgeTaskPayload,
} from "@/lib/bridge-service";
import type { LocalExecutorRequest } from "@/lib/local-executor";

const BRIDGE_WAIT_MS = Number(process.env.MOTOR_CODE_BRIDGE_TIMEOUT_MS || "90000");
const BRIDGE_POLL_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isBridgeExecutorConfigured(): boolean {
  return Boolean(
    process.env.MOTOR_CODE_BRIDGE_ID?.trim() ||
      listBridges().length > 0
  );
}

export function getActiveBridgeId(): string | null {
  const env = process.env.MOTOR_CODE_BRIDGE_ID?.trim();
  if (env) return env;
  const bridges = listBridges();
  return bridges[0]?.bridge_id ?? null;
}

export function isBridgeOnline(bridge_id: string): boolean {
  const row = db
    .prepare(`SELECT last_seen_at FROM pc_bridges WHERE bridge_id = ?`)
    .get(bridge_id) as { last_seen_at: string | null } | undefined;
  if (!row?.last_seen_at) return false;
  const seen = new Date(row.last_seen_at).getTime();
  return Date.now() - seen < 120_000;
}

function toBridgePayload(body: LocalExecutorRequest): BridgeTaskPayload {
  return {
    op: body.op,
    path: body.path,
    content: body.content,
    command: body.command,
    cwd: body.cwd,
  };
}

function getTaskResult(task_id: number): {
  status: string;
  result_json: string | null;
} | null {
  return (
    (db
      .prepare(`SELECT status, result_json FROM pc_bridge_tasks WHERE id = ?`)
      .get(task_id) as { status: string; result_json: string | null } | undefined) ??
    null
  );
}

export async function callBridgeExecutor(
  body: LocalExecutorRequest,
  bridgeId?: string | null
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const bridge_id = bridgeId?.trim() || getActiveBridgeId();
  if (!bridge_id) {
    return { ok: false, error: "pc_bridge_not_configured" };
  }
  if (!isBridgeOnline(bridge_id)) {
    return { ok: false, error: "pc_bridge_offline" };
  }

  const task_id = enqueueBridgeTask(bridge_id, toBridgePayload(body));
  const deadline = Date.now() + BRIDGE_WAIT_MS;

  while (Date.now() < deadline) {
    await sleep(BRIDGE_POLL_MS);
    const row = getTaskResult(task_id);
    if (!row) continue;
    if (row.status === "done" || row.status === "error") {
      let data: Record<string, unknown> = {};
      try {
        data = row.result_json
          ? (JSON.parse(row.result_json) as Record<string, unknown>)
          : {};
      } catch {
        data = { raw: row.result_json };
      }
      return {
        ok: row.status === "done" && Boolean(data.ok ?? true),
        data,
        error:
          row.status === "error"
            ? String(data.error ?? data.detail ?? "bridge_task_failed")
            : undefined,
      };
    }
  }

  return { ok: false, error: "pc_bridge_timeout" };
}
