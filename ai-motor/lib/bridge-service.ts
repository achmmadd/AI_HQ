import { createHash, randomBytes } from "crypto";
import db from "@/lib/db/database";
import { ensureBridgeSchema } from "@/lib/db/bridge-schema";

ensureBridgeSchema();

export type BridgeTaskPayload = {
  op: "read_file" | "write_file" | "list_dir" | "run_command";
  path?: string;
  content?: string;
  command?: string;
  cwd?: string;
};

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function registerBridge(opts: {
  device_name: string;
  workspace_hint?: string;
}): { bridge_id: string; secret: string } {
  const bridge_id = `bridge_${randomBytes(8).toString("hex")}`;
  const secret = randomBytes(24).toString("hex");
  db.prepare(
    `INSERT INTO pc_bridges (bridge_id, device_name, secret_hash, workspace_hint)
     VALUES (?, ?, ?, ?)`
  ).run(
    bridge_id,
    opts.device_name.slice(0, 120),
    hashSecret(secret),
    opts.workspace_hint?.slice(0, 500) ?? null
  );
  return { bridge_id, secret };
}

export function verifyBridgeAuth(
  bridge_id: string,
  secret: string
): boolean {
  const row = db
    .prepare(`SELECT secret_hash FROM pc_bridges WHERE bridge_id = ?`)
    .get(bridge_id) as { secret_hash: string } | undefined;
  if (!row) return false;
  return row.secret_hash === hashSecret(secret);
}

export function touchBridge(bridge_id: string): void {
  db.prepare(
    `UPDATE pc_bridges SET last_seen_at = datetime('now') WHERE bridge_id = ?`
  ).run(bridge_id);
}

export function enqueueBridgeTask(
  bridge_id: string,
  payload: BridgeTaskPayload
): number {
  const result = db
    .prepare(
      `INSERT INTO pc_bridge_tasks (bridge_id, payload_json, status)
       VALUES (?, ?, 'pending')`
    )
    .run(bridge_id, JSON.stringify(payload));
  return Number(result.lastInsertRowid);
}

export function pollBridgeTask(bridge_id: string): {
  task_id: number;
  payload: BridgeTaskPayload;
} | null {
  touchBridge(bridge_id);
  const row = db
    .prepare(
      `SELECT id, payload_json FROM pc_bridge_tasks
       WHERE bridge_id = ? AND status = 'pending'
       ORDER BY id ASC LIMIT 1`
    )
    .get(bridge_id) as { id: number; payload_json: string } | undefined;
  if (!row) return null;
  db.prepare(
    `UPDATE pc_bridge_tasks SET status = 'running' WHERE id = ?`
  ).run(row.id);
  return {
    task_id: row.id,
    payload: JSON.parse(row.payload_json) as BridgeTaskPayload,
  };
}

export function completeBridgeTask(
  task_id: number,
  bridge_id: string,
  result: Record<string, unknown>,
  ok: boolean
): void {
  db.prepare(
    `UPDATE pc_bridge_tasks SET status = ?, result_json = ?, completed_at = datetime('now')
     WHERE id = ? AND bridge_id = ?`
  ).run(ok ? "done" : "error", JSON.stringify(result), task_id, bridge_id);
}

export function listBridges(): {
  bridge_id: string;
  device_name: string;
  workspace_hint: string | null;
  last_seen_at: string;
  created_at: string;
}[] {
  return db
    .prepare(
      `SELECT bridge_id, device_name, workspace_hint, last_seen_at, created_at
       FROM pc_bridges ORDER BY last_seen_at DESC`
    )
    .all() as {
    bridge_id: string;
    device_name: string;
    workspace_hint: string | null;
    last_seen_at: string;
    created_at: string;
  }[];
}

export function revokeBridge(bridge_id: string): boolean {
  const row = db
    .prepare(`SELECT bridge_id FROM pc_bridges WHERE bridge_id = ?`)
    .get(bridge_id) as { bridge_id: string } | undefined;
  if (!row) return false;
  db.prepare(`DELETE FROM pc_bridge_tasks WHERE bridge_id = ?`).run(bridge_id);
  db.prepare(`DELETE FROM pc_bridges WHERE bridge_id = ?`).run(bridge_id);
  return true;
}
