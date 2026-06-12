import type DatabaseT from "better-sqlite3";

/**
 * Async campaign pack jobs (Cloudflare-proof).
 * Persisted in SQLite so status polls survive process restarts.
 */

type DB = DatabaseT.Database;

export type CampaignJobStatus = "pending" | "running" | "done" | "error";

export type CampaignJobRow = {
  id: number;
  job_id: string;
  klant: string;
  pack_id: string | null;
  status: CampaignJobStatus;
  phase: string | null;
  progress_message: string | null;
  request_json: string;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

let schemaReadyFor: WeakSet<DB> = new WeakSet();

export function ensureCampaignJobsSchema(db: DB): void {
  if (schemaReadyFor.has(db)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS fumero_campaign_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      klant TEXT NOT NULL DEFAULT 'fumero',
      pack_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'done', 'error')),
      phase TEXT,
      progress_message TEXT,
      request_json TEXT NOT NULL,
      result_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fumero_campaign_jobs_klant
      ON fumero_campaign_jobs (klant, job_id);
    CREATE INDEX IF NOT EXISTS idx_fumero_campaign_jobs_status
      ON fumero_campaign_jobs (status, updated_at);
  `);
  schemaReadyFor.add(db);
}

export function insertCampaignJob(
  db: DB,
  params: {
    jobId: string;
    klant: string;
    packId: string;
    request: unknown;
  }
): CampaignJobRow {
  ensureCampaignJobsSchema(db);
  db.prepare(
    `INSERT INTO fumero_campaign_jobs (job_id, klant, pack_id, status, request_json)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(params.jobId, params.klant, params.packId, JSON.stringify(params.request));
  const row = getCampaignJob(db, params.jobId, params.klant);
  if (!row) throw new Error("Campaign job kon niet worden aangemaakt");
  return row;
}

export function getCampaignJob(
  db: DB,
  jobId: string,
  klant: string
): CampaignJobRow | undefined {
  ensureCampaignJobsSchema(db);
  return db
    .prepare(
      `SELECT * FROM fumero_campaign_jobs WHERE job_id = ? AND klant = ? LIMIT 1`
    )
    .get(jobId, klant) as CampaignJobRow | undefined;
}

export function markCampaignJobRunning(db: DB, jobId: string): void {
  ensureCampaignJobsSchema(db);
  db.prepare(
    `UPDATE fumero_campaign_jobs
        SET status = 'running',
            phase = COALESCE(phase, 'queued'),
            progress_message = COALESCE(progress_message, 'Campaign pack wordt gestart...'),
            started_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status = 'pending'`
  ).run(jobId);
}

export function updateCampaignJobProgress(
  db: DB,
  jobId: string,
  params: { phase: string; message: string }
): void {
  ensureCampaignJobsSchema(db);
  db.prepare(
    `UPDATE fumero_campaign_jobs
        SET phase = ?,
            progress_message = ?,
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(params.phase.slice(0, 80), params.message.slice(0, 500), jobId);
}

export function touchCampaignJob(db: DB, jobId: string): void {
  ensureCampaignJobsSchema(db);
  db.prepare(
    `UPDATE fumero_campaign_jobs
        SET updated_at = datetime('now')
      WHERE job_id = ? AND status = 'running'`
  ).run(jobId);
}

export function markCampaignJobDone(
  db: DB,
  jobId: string,
  params: { packId: string; result: unknown }
): void {
  ensureCampaignJobsSchema(db);
  db.prepare(
    `UPDATE fumero_campaign_jobs
        SET status = 'done',
            phase = 'done',
            progress_message = 'Campaign pack is klaar.',
            pack_id = ?,
            result_json = ?,
            error = NULL,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(params.packId, JSON.stringify(params.result ?? null), jobId);
}

export function markCampaignJobError(
  db: DB,
  jobId: string,
  error: string,
  partial?: { packId?: string; result?: unknown }
): void {
  ensureCampaignJobsSchema(db);
  db.prepare(
    `UPDATE fumero_campaign_jobs
        SET status = 'error',
            phase = 'error',
            progress_message = 'Campaign pack genereren mislukt.',
            pack_id = COALESCE(?, pack_id),
            result_json = COALESCE(?, result_json),
            error = ?,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(
    partial?.packId ?? null,
    partial?.result === undefined ? null : JSON.stringify(partial.result),
    error.slice(0, 2000),
    jobId
  );
}

export function reapStaleCampaignJobs(db: DB, staleMs: number): number {
  ensureCampaignJobsSchema(db);
  const seconds = Math.max(1, Math.round(staleMs / 1000));
  const res = db
    .prepare(
      `UPDATE fumero_campaign_jobs
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

export function __resetCampaignJobsSchemaCache(): void {
  schemaReadyFor = new WeakSet();
}
