import db from "@/lib/db/database";

let ready = false;

function colExists(table: string, name: string): boolean {
  const cols = db
    .prepare(`SELECT name FROM pragma_table_info(?)`)
    .all(table) as { name: string }[];
  return cols.some((c) => c.name === name);
}

function addCol(sql: string): void {
  try {
    db.exec(sql);
  } catch {
    /* exists */
  }
}

export function ensurePlatformSchema(): void {
  if (ready) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT DEFAULT 'system',
      action TEXT NOT NULL,
      resource TEXT,
      detail_json TEXT,
      klant TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS usage_budgets (
      klant TEXT PRIMARY KEY,
      monthly_eur_limit REAL NOT NULL DEFAULT 50,
      alert_threshold_pct REAL NOT NULL DEFAULT 80,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS code_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      klant TEXT NOT NULL,
      workspace TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Agent sessie',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_code_sessions_klant ON code_sessions(klant, workspace);

    CREATE TABLE IF NOT EXISTS code_session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES code_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_code_session_messages ON code_session_messages(session_id);

    CREATE TABLE IF NOT EXISTS motor_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      klant TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      prompt_template TEXT NOT NULL,
      config_json TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(klant, slug)
    );

    CREATE TABLE IF NOT EXISTS deploy_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      klant TEXT,
      source TEXT NOT NULL,
      slug TEXT,
      repo_url TEXT,
      live_url TEXT,
      environment TEXT NOT NULL DEFAULT 'production',
      status TEXT NOT NULL DEFAULT 'success',
      deployment_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_deploy_history_klant ON deploy_history(klant, created_at);
  `);

  if (!colExists("approvals", "klant")) {
    addCol(`ALTER TABLE approvals ADD COLUMN klant TEXT`);
  }
  if (!colExists("approvals", "resolved_by")) {
    addCol(`ALTER TABLE approvals ADD COLUMN resolved_by TEXT`);
  }
  if (!colExists("approvals", "reject_reason")) {
    addCol(`ALTER TABLE approvals ADD COLUMN reject_reason TEXT`);
  }
  if (!colExists("automation_tasks", "klant")) {
    addCol(`ALTER TABLE automation_tasks ADD COLUMN klant TEXT DEFAULT 'fumero'`);
  }
  if (!colExists("fumero_reviews", "klant")) {
    addCol(`ALTER TABLE fumero_reviews ADD COLUMN klant TEXT DEFAULT 'bokas'`);
  }

  db.exec(`
    INSERT OR IGNORE INTO usage_budgets (klant, monthly_eur_limit, alert_threshold_pct)
    VALUES ('bokas', 100, 80), ('fumero', 100, 80);
  `);

  ready = true;
}
