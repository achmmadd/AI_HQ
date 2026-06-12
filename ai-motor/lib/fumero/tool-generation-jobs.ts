import type DatabaseT from "better-sqlite3";

/**
 * Async Fumero tool/widget generatie jobs (Cloudflare-proof).
 * Tool-builds duren vaak >100s; synchrone POST breekt achter Cloudflare (524 HTML).
 */

type DB = DatabaseT.Database;

export type ToolGenerationJobAction = "create" | "iterate";
export type ToolGenerationJobStatus = "pending" | "running" | "done" | "error";

export type ToolGenerationJobPayload = {
  name?: string;
  deploy_type?: string;
  template_id?: string;
  tool_id?: number;
};

export type ToolGenerationJobRow = {
  id: number;
  job_id: string;
  klant: string;
  action: ToolGenerationJobAction;
  status: ToolGenerationJobStatus;
  phase: string | null;
  progress_message: string | null;
  prompt: string;
  payload_json: string | null;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

let schemaReadyFor: WeakSet<DB> = new WeakSet();

export function ensureToolGenerationJobsSchema(db: DB): void {
  if (schemaReadyFor.has(db)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS fumero_tool_generation_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      klant TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'create'
        CHECK (action IN ('create', 'iterate')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'done', 'error')),
      phase TEXT,
      progress_message TEXT,
      prompt TEXT NOT NULL,
      payload_json TEXT,
      result_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fumero_tool_gen_jobs_klant
      ON fumero_tool_generation_jobs (klant, job_id);
    CREATE INDEX IF NOT EXISTS idx_fumero_tool_gen_jobs_status
      ON fumero_tool_generation_jobs (status, updated_at);
  `);
  schemaReadyFor.add(db);
}

export function insertToolGenerationJob(
  db: DB,
  params: {
    jobId: string;
    klant: string;
    action: ToolGenerationJobAction;
    prompt: string;
    payload?: ToolGenerationJobPayload;
  }
): ToolGenerationJobRow {
  ensureToolGenerationJobsSchema(db);
  db.prepare(
    `INSERT INTO fumero_tool_generation_jobs (job_id, klant, action, status, prompt, payload_json)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  ).run(
    params.jobId,
    params.klant,
    params.action,
    params.prompt,
    params.payload ? JSON.stringify(params.payload) : null
  );
  const row = getToolGenerationJob(db, params.jobId, params.klant);
  if (!row) throw new Error("Tool-job kon niet worden aangemaakt");
  return row;
}

export function getToolGenerationJob(
  db: DB,
  jobId: string,
  klant: string
): ToolGenerationJobRow | undefined {
  ensureToolGenerationJobsSchema(db);
  return db
    .prepare(
      `SELECT * FROM fumero_tool_generation_jobs WHERE job_id = ? AND klant = ? LIMIT 1`
    )
    .get(jobId, klant) as ToolGenerationJobRow | undefined;
}

export function parseToolGenerationPayload(
  row: ToolGenerationJobRow
): ToolGenerationJobPayload {
  if (!row.payload_json) return {};
  try {
    const parsed = JSON.parse(row.payload_json) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as ToolGenerationJobPayload)
      : {};
  } catch {
    return {};
  }
}

export function markToolGenerationJobRunning(db: DB, jobId: string): void {
  ensureToolGenerationJobsSchema(db);
  db.prepare(
    `UPDATE fumero_tool_generation_jobs
        SET status = 'running',
            phase = COALESCE(phase, 'queued'),
            progress_message = COALESCE(progress_message, 'Tool wordt gebouwd...'),
            started_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status = 'pending'`
  ).run(jobId);
}

export function updateToolGenerationJobProgress(
  db: DB,
  jobId: string,
  params: { phase: string; message: string }
): void {
  ensureToolGenerationJobsSchema(db);
  db.prepare(
    `UPDATE fumero_tool_generation_jobs
        SET phase = ?,
            progress_message = ?,
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(params.phase.slice(0, 80), params.message.slice(0, 500), jobId);
}

export function touchToolGenerationJob(db: DB, jobId: string): void {
  ensureToolGenerationJobsSchema(db);
  db.prepare(
    `UPDATE fumero_tool_generation_jobs
        SET updated_at = datetime('now')
      WHERE job_id = ? AND status = 'running'`
  ).run(jobId);
}

export function markToolGenerationJobDone(
  db: DB,
  jobId: string,
  result: unknown
): void {
  ensureToolGenerationJobsSchema(db);
  db.prepare(
    `UPDATE fumero_tool_generation_jobs
        SET status = 'done',
            phase = 'done',
            progress_message = 'Tool is klaar.',
            result_json = ?,
            error = NULL,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(JSON.stringify(result ?? null), jobId);
}

export function markToolGenerationJobError(
  db: DB,
  jobId: string,
  error: string
): void {
  ensureToolGenerationJobsSchema(db);
  db.prepare(
    `UPDATE fumero_tool_generation_jobs
        SET status = 'error',
            phase = 'error',
            progress_message = 'Generatie mislukt.',
            error = ?,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(error.slice(0, 2000), jobId);
}

export function reapStaleToolGenerationJobs(db: DB, staleMs: number): number {
  ensureToolGenerationJobsSchema(db);
  const seconds = Math.max(1, Math.round(staleMs / 1000));
  const res = db
    .prepare(
      `UPDATE fumero_tool_generation_jobs
          SET status = 'error',
              phase = 'error',
              progress_message = 'Generatie afgebroken.',
              error = 'Generatie afgebroken: proces leek vastgelopen of herstart tijdens de bouw.',
              finished_at = datetime('now'),
              updated_at = datetime('now')
        WHERE status IN ('pending', 'running')
          AND updated_at < datetime('now', ?)`
    )
    .run(`-${seconds} seconds`);
  return res.changes;
}

export function __resetToolGenerationJobsSchemaCache(): void {
  schemaReadyFor = new WeakSet();
}
