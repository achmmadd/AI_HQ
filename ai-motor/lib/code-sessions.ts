import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";

export type CodeSessionRow = {
  id: number;
  klant: string;
  workspace: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type CodeSessionMessageRow = {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  meta_json: string | null;
  created_at: string;
};

export function listCodeSessions(
  klant: string,
  workspace: string
): CodeSessionRow[] {
  ensurePlatformSchema();
  return db
    .prepare(
      `SELECT * FROM code_sessions
       WHERE klant = ? AND workspace = ?
       ORDER BY datetime(updated_at) DESC LIMIT 50`
    )
    .all(klant, workspace) as CodeSessionRow[];
}

export function createCodeSession(
  klant: string,
  workspace: string,
  title?: string
): CodeSessionRow {
  ensurePlatformSchema();
  const t = title?.trim() || "Agent sessie";
  const result = db
    .prepare(
      `INSERT INTO code_sessions (klant, workspace, title) VALUES (?, ?, ?)`
    )
    .run(klant, workspace, t);
  return db
    .prepare(`SELECT * FROM code_sessions WHERE id = ?`)
    .get(result.lastInsertRowid) as CodeSessionRow;
}

export function getCodeSession(id: number): CodeSessionRow | undefined {
  ensurePlatformSchema();
  return db
    .prepare(`SELECT * FROM code_sessions WHERE id = ?`)
    .get(id) as CodeSessionRow | undefined;
}

export function touchCodeSession(id: number): void {
  ensurePlatformSchema();
  db.prepare(
    `UPDATE code_sessions SET updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

export function getSessionMessages(
  sessionId: number
): CodeSessionMessageRow[] {
  ensurePlatformSchema();
  return db
    .prepare(
      `SELECT * FROM code_session_messages
       WHERE session_id = ? ORDER BY id ASC`
    )
    .all(sessionId) as CodeSessionMessageRow[];
}

export function appendSessionMessage(opts: {
  sessionId: number;
  role: "user" | "assistant";
  content: string;
  meta?: Record<string, unknown>;
}): void {
  ensurePlatformSchema();
  db.prepare(
    `INSERT INTO code_session_messages (session_id, role, content, meta_json)
     VALUES (?, ?, ?, ?)`
  ).run(
    opts.sessionId,
    opts.role,
    opts.content,
    opts.meta ? JSON.stringify(opts.meta) : null
  );
  touchCodeSession(opts.sessionId);
}

export function deleteCodeSession(id: number): void {
  ensurePlatformSchema();
  db.prepare(`DELETE FROM code_sessions WHERE id = ?`).run(id);
}
