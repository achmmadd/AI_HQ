import type DatabaseT from "better-sqlite3";

/**
 * Async full-app generatie jobs (Cloudflare-proof builder).
 *
 * Achtergrond: full-app generatie kan langer duren dan Cloudflare's ~100s
 * request-window. In plaats van synchroon te wachten (en 524'en of de
 * deadline-cap te raken) draait de generatie als achtergrond-job in hetzelfde
 * PM2-proces. Status wordt in SQLite gepersisteerd zodat een status-poll werkt
 * zelfs als de in-memory map verloren gaat.
 *
 * Dit bestand bevat ALLEEN de db-agnostische store (elke functie krijgt een
 * better-sqlite3 `Database` mee) zodat de lifecycle puur unit-testbaar is met
 * een in-memory db. De daadwerkelijke runner (`app-generation-runner.ts`)
 * koppelt deze functies aan de gedeelde productie-db.
 */

type DB = DatabaseT.Database;

export type GenerationJobAction = "create" | "refine";
export type GenerationJobStatus = "pending" | "running" | "done" | "error";

export type GenerationJobRow = {
  id: number;
  job_id: string;
  klant: string;
  action: GenerationJobAction;
  status: GenerationJobStatus;
  phase: string | null;
  progress_message: string | null;
  prompt: string;
  slug: string | null;
  plan_json: string | null;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

let schemaReadyFor: WeakSet<DB> = new WeakSet();

export function ensureAppGenerationJobsSchema(db: DB): void {
  if (schemaReadyFor.has(db)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_generation_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      klant TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'create'
        CHECK (action IN ('create', 'refine')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'done', 'error')),
      phase TEXT,
      progress_message TEXT,
      prompt TEXT NOT NULL,
      slug TEXT,
      plan_json TEXT,
      result_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_app_gen_jobs_klant
      ON app_generation_jobs (klant, job_id);
    CREATE INDEX IF NOT EXISTS idx_app_gen_jobs_status
      ON app_generation_jobs (status, updated_at);
  `);
  const columns = new Set(
    (
      db.prepare(`PRAGMA table_info(app_generation_jobs)`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name)
  );
  const addColumn = (name: string, ddl: string) => {
    if (!columns.has(name)) db.exec(`ALTER TABLE app_generation_jobs ADD COLUMN ${ddl}`);
  };
  addColumn("phase", "phase TEXT");
  addColumn("progress_message", "progress_message TEXT");
  addColumn("plan_json", "plan_json TEXT");
  schemaReadyFor.add(db);
}

export function insertGenerationJob(
  db: DB,
  params: {
    jobId: string;
    klant: string;
    action: GenerationJobAction;
    prompt: string;
    slug?: string | null;
  }
): GenerationJobRow {
  ensureAppGenerationJobsSchema(db);
  db.prepare(
    `INSERT INTO app_generation_jobs (job_id, klant, action, status, prompt, slug)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  ).run(
    params.jobId,
    params.klant,
    params.action,
    params.prompt,
    params.slug ?? null
  );
  const row = getGenerationJob(db, params.jobId, params.klant);
  if (!row) throw new Error("Job kon niet worden aangemaakt");
  return row;
}

/** Klant-scoped lookup (status-poll moet zijn eigen workspace teruggeven). */
export function getGenerationJob(
  db: DB,
  jobId: string,
  klant: string
): GenerationJobRow | undefined {
  ensureAppGenerationJobsSchema(db);
  return db
    .prepare(
      `SELECT * FROM app_generation_jobs WHERE job_id = ? AND klant = ? LIMIT 1`
    )
    .get(jobId, klant) as GenerationJobRow | undefined;
}

export function markGenerationJobRunning(db: DB, jobId: string): void {
  ensureAppGenerationJobsSchema(db);
  db.prepare(
    `UPDATE app_generation_jobs
        SET status = 'running',
            phase = COALESCE(phase, 'queued'),
            progress_message = COALESCE(progress_message, 'Generatie wordt gestart...'),
            started_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status = 'pending'`
  ).run(jobId);
}

export function updateGenerationJobProgress(
  db: DB,
  jobId: string,
  params: { phase: string; message: string; plan?: unknown }
): void {
  ensureAppGenerationJobsSchema(db);
  db.prepare(
    `UPDATE app_generation_jobs
        SET phase = ?,
            progress_message = ?,
            plan_json = COALESCE(?, plan_json),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(
    params.phase.slice(0, 80),
    params.message.slice(0, 500),
    params.plan === undefined ? null : JSON.stringify(params.plan),
    jobId
  );
}

/** Heartbeat: houdt updated_at vers zodat stale-detectie een levende job niet doodt. */
export function touchGenerationJob(db: DB, jobId: string): void {
  ensureAppGenerationJobsSchema(db);
  db.prepare(
    `UPDATE app_generation_jobs
        SET updated_at = datetime('now')
      WHERE job_id = ? AND status = 'running'`
  ).run(jobId);
}

export function markGenerationJobDone(
  db: DB,
  jobId: string,
  params: { slug?: string | null; result: unknown }
): void {
  ensureAppGenerationJobsSchema(db);
  db.prepare(
    `UPDATE app_generation_jobs
        SET status = 'done',
            phase = 'done',
            progress_message = 'App is klaar.',
            slug = COALESCE(?, slug),
            result_json = ?,
            error = NULL,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(params.slug ?? null, JSON.stringify(params.result ?? null), jobId);
}

export function markGenerationJobError(
  db: DB,
  jobId: string,
  error: string
): void {
  ensureAppGenerationJobsSchema(db);
  db.prepare(
    `UPDATE app_generation_jobs
        SET status = 'error',
            phase = 'error',
            progress_message = 'Generatie mislukt.',
            error = ?,
            finished_at = datetime('now'),
            updated_at = datetime('now')
      WHERE job_id = ? AND status IN ('pending', 'running')`
  ).run(error.slice(0, 2000), jobId);
}

/**
 * Markeer vastgelopen jobs als error: een 'running'/'pending' job waarvan
 * updated_at ouder is dan `staleMs` betekent dat het proces midden in de job
 * is gecrasht/herstart. Geeft het aantal opgeschoonde jobs terug.
 */
export function reapStaleGenerationJobs(db: DB, staleMs: number): number {
  ensureAppGenerationJobsSchema(db);
  const seconds = Math.max(1, Math.round(staleMs / 1000));
  const res = db
    .prepare(
      `UPDATE app_generation_jobs
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

/** Test-helper: reset de schema-cache (alleen voor unit tests). */
export function __resetGenerationJobsSchemaCache(): void {
  schemaReadyFor = new WeakSet();
}
