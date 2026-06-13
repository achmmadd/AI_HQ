import type DatabaseT from "better-sqlite3";

type DB = DatabaseT.Database;

export type StudioVideoJobStatus = "pending" | "running" | "done" | "error";

export type StudioVideoJobRow = {
  id: number;
  job_id: string;
  klant: string;
  status: StudioVideoJobStatus;
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

export function ensureStudioVideoJobsSchema(db: DB): void {
  if (schemaReadyFor.has(db)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_studio_video_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      klant TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_photo_studio_video_jobs_klant
      ON photo_studio_video_jobs (klant, job_id);
  `);
  schemaReadyFor.add(db);
}

export function insertStudioVideoJob(
  db: DB,
  params: { jobId: string; klant: string; request: unknown }
): StudioVideoJobRow {
  ensureStudioVideoJobsSchema(db);
  db.prepare(
    `INSERT INTO photo_studio_video_jobs (job_id, klant, status, request_json)
     VALUES (?, ?, 'pending', ?)`
  ).run(params.jobId, params.klant, JSON.stringify(params.request));
  const row = getStudioVideoJob(db, params.jobId, params.klant);
  if (!row) throw new Error("Video job kon niet worden aangemaakt");
  return row;
}

export function getStudioVideoJob(
  db: DB,
  jobId: string,
  klant: string
): StudioVideoJobRow | undefined {
  ensureStudioVideoJobsSchema(db);
  return db
    .prepare(
      `SELECT * FROM photo_studio_video_jobs WHERE job_id = ? AND klant = ? LIMIT 1`
    )
    .get(jobId, klant) as StudioVideoJobRow | undefined;
}

export function markStudioVideoJobRunning(db: DB, jobId: string): void {
  ensureStudioVideoJobsSchema(db);
  db.prepare(
    `UPDATE photo_studio_video_jobs
        SET status = 'running',
            phase = 'fal',
            progress_message = 'Video wordt gegenereerd via fal.ai…',
            started_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status = 'pending'`
  ).run(jobId);
}

export function updateStudioVideoJobProgress(
  db: DB,
  jobId: string,
  params: { phase: string; message: string }
): void {
  ensureStudioVideoJobsSchema(db);
  db.prepare(
    `UPDATE photo_studio_video_jobs
        SET phase = ?,
            progress_message = ?,
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(params.phase.slice(0, 80), params.message.slice(0, 500), jobId);
}

export function touchStudioVideoJob(db: DB, jobId: string): void {
  ensureStudioVideoJobsSchema(db);
  db.prepare(
    `UPDATE photo_studio_video_jobs
        SET updated_at = datetime('now')
      WHERE job_id = ? AND status = 'running'`
  ).run(jobId);
}

export function markStudioVideoJobDone(
  db: DB,
  jobId: string,
  result: unknown
): void {
  ensureStudioVideoJobsSchema(db);
  db.prepare(
    `UPDATE photo_studio_video_jobs
        SET status = 'done',
            phase = 'done',
            progress_message = 'Video is klaar.',
            result_json = ?,
            error = NULL,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(JSON.stringify(result ?? null), jobId);
}

export function markStudioVideoJobError(db: DB, jobId: string, error: string): void {
  ensureStudioVideoJobsSchema(db);
  db.prepare(
    `UPDATE photo_studio_video_jobs
        SET status = 'error',
            phase = 'error',
            progress_message = 'Video genereren mislukt.',
            error = ?,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(error.slice(0, 2000), jobId);
}

export function reapStaleStudioVideoJobs(db: DB, staleMs: number): number {
  ensureStudioVideoJobsSchema(db);
  const seconds = Math.max(1, Math.round(staleMs / 1000));
  const res = db
    .prepare(
      `UPDATE photo_studio_video_jobs
          SET status = 'error',
              phase = 'error',
              progress_message = 'Generatie afgebroken.',
              error = 'Video-generatie duurde te lang of het proces herstartte.',
              finished_at = datetime('now'),
              updated_at = datetime('now')
        WHERE status IN ('pending', 'running')
          AND updated_at < datetime('now', ?)`
    )
    .run(`-${seconds} seconds`);
  return res.changes;
}

export function __resetStudioVideoJobsSchemaCache(): void {
  schemaReadyFor = new WeakSet();
}
