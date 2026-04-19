import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const home = process.env.HOME || "/home/pietje";
const DB_DIR = path.join(home, "AI_HQ", "data");
const DB_PATH = path.join(DB_DIR, "ai-motor.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

/** Alle tabellen aanmaken / migreren voor productie. */
export function initDb(): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    klant TEXT DEFAULT 'algemeen',
    afdeling TEXT,
    priority TEXT DEFAULT 'normaal',
    status TEXT DEFAULT 'open',
    due_date TEXT,
    source TEXT DEFAULT 'handmatig',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    klant TEXT DEFAULT 'algemeen',
    start_time TEXT NOT NULL,
    end_time TEXT,
    all_day INTEGER DEFAULT 0,
    source TEXT DEFAULT 'handmatig',
    todo_id INTEGER REFERENCES todos(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    klant TEXT,
    priority TEXT DEFAULT 'normaal',
    read INTEGER DEFAULT 0,
    telegram_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    action TEXT NOT NULL,
    payload TEXT,
    status TEXT DEFAULT 'pending',
    requested_by TEXT DEFAULT 'factory-os',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    afdeling TEXT,
    model TEXT,
    tokens INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    klant TEXT,
    analysis TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bokas_reserveringen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    email TEXT,
    telefoon TEXT,
    datum TEXT NOT NULL,
    tijd TEXT NOT NULL,
    personen INTEGER NOT NULL,
    opmerkingen TEXT,
    status TEXT DEFAULT 'bevestigd',
    source TEXT DEFAULT 'handmatig',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bokas_personeel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    rol TEXT NOT NULL,
    telefoon TEXT,
    email TEXT,
    actief INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bokas_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personeels_id INTEGER REFERENCES bokas_personeel(id),
    datum TEXT NOT NULL,
    start_tijd TEXT NOT NULL,
    eind_tijd TEXT NOT NULL,
    rol TEXT,
    status TEXT DEFAULT 'gepland'
  );

  CREATE TABLE IF NOT EXISTS bokas_menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    categorie TEXT NOT NULL,
    prijs REAL,
    beschrijving TEXT,
    actief INTEGER DEFAULT 1,
    week TEXT,
    vegan INTEGER DEFAULT 0,
    gluten_vrij INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS fumero_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    source TEXT DEFAULT 'google',
    reviewer_name TEXT,
    rating INTEGER,
    review_text TEXT NOT NULL,
    suggested_reply TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant TEXT NOT NULL,
    platform TEXT NOT NULL,
    type TEXT DEFAULT 'post',
    titel TEXT,
    content TEXT NOT NULL,
    hashtags TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    published_at TEXT,
    source TEXT DEFAULT 'ai',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant TEXT NOT NULL,
    platform TEXT NOT NULL,
    naam TEXT NOT NULL,
    prompt TEXT NOT NULL,
    toon TEXT DEFAULT 'professioneel',
    actief INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant TEXT,
    afdeling TEXT,
    model TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    success INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'live',
    klant TEXT DEFAULT 'system',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Nieuwe chat',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
  const chatCols = db
    .prepare(`SELECT name FROM pragma_table_info('chat_history')`)
    .all() as { name: string }[];

  db.exec(`
  CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hypothesis TEXT NOT NULL DEFAULT '',
    variant_a TEXT NOT NULL,
    variant_b TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'done', 'archived')),
    winner_variant TEXT CHECK (winner_variant IN ('a', 'b') OR winner_variant IS NULL),
    klant TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    ends_at TEXT,
    closed_at TEXT,
    summary_json TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
  CREATE INDEX IF NOT EXISTS idx_experiments_klant ON experiments(klant);
  `);

  if (!chatCols.some((c) => c.name === "conversation_id")) {
    db.exec(
      `ALTER TABLE chat_history ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)`
    );
  }
  if (!chatCols.some((c) => c.name === "experiment_id")) {
    db.exec(
      `ALTER TABLE chat_history ADD COLUMN experiment_id INTEGER REFERENCES experiments(id)`
    );
  }
  if (!chatCols.some((c) => c.name === "experiment_variant")) {
    db.exec(`ALTER TABLE chat_history ADD COLUMN experiment_variant TEXT`);
  }
  if (!chatCols.some((c) => c.name === "latency_ms")) {
    db.exec(`ALTER TABLE chat_history ADD COLUMN latency_ms INTEGER`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_klant ON conversations(klant);
    CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_chat_history_experiment ON chat_history(experiment_id);
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS message_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL UNIQUE REFERENCES chat_history(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    reason TEXT,
    klant TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_improvements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue TEXT NOT NULL,
    reason_cluster TEXT,
    count INTEGER NOT NULL DEFAULT 0,
    suggested_fix TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new', 'reviewed', 'applied', 'rejected')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_message_feedback_klant ON message_feedback(klant);
  CREATE INDEX IF NOT EXISTS idx_message_feedback_created ON message_feedback(created_at);
  CREATE INDEX IF NOT EXISTS idx_system_improvements_status ON system_improvements(status);

  CREATE TABLE IF NOT EXISTS automation_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    schedule_kind TEXT NOT NULL DEFAULT 'daily'
      CHECK (schedule_kind IN ('daily', 'weekly')),
    schedule_time TEXT NOT NULL DEFAULT '09:00',
    schedule_weekday INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    approval_required INTEGER NOT NULL DEFAULT 1,
    integration TEXT,
    config_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES automation_tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
      CHECK (status IN (
        'pending_approval',
        'queued',
        'running',
        'success',
        'failed',
        'cancelled',
        'rejected'
      )),
    trigger TEXT NOT NULL DEFAULT 'cron'
      CHECK (trigger IN ('cron', 'manual')),
    detail TEXT,
    error_message TEXT,
    approved_at TEXT,
    rejected_at TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_automation_runs_task ON automation_runs(task_id);
  CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
  CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(created_at);

  CREATE TABLE IF NOT EXISTS agent_api_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_key TEXT NOT NULL,
    automation_task_id INTEGER REFERENCES automation_tasks(id) ON DELETE SET NULL,
    input_prompt TEXT,
    status TEXT NOT NULL
      CHECK (status IN ('running', 'success', 'failed')),
    detail TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_agent_api_runs_created ON agent_api_runs(created_at);

  CREATE TABLE IF NOT EXISTS fumero_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    order_date TEXT NOT NULL,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    customer_hint TEXT,
    raw_summary TEXT,
    scraped_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'invoiced_pending'
      CHECK (status IN ('invoiced_pending', 'invoiced_sent', 'cancelled')),
    line_items_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_automation_invoices_status ON automation_invoices(status);

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    supplier_url TEXT,
    low_stock_threshold INTEGER DEFAULT 10,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendor_catalog_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_key TEXT NOT NULL,
    product_title TEXT NOT NULL,
    first_seen_at TEXT DEFAULT (datetime('now')),
    UNIQUE(vendor_key, product_title)
  );

  CREATE INDEX IF NOT EXISTS idx_vendor_snapshot_vendor ON vendor_catalog_snapshot(vendor_key);
  `);
}

initDb();

const fumeroTemplateSeed: [string, string, string, string, string][] = [
  [
    "fumero",
    "instagram",
    "Product highlight",
    "Schrijf een Instagram post voor Fumero over {product}. Toon: premium, discreet, 18+. Max 150 woorden. Voeg 5 relevante hashtags toe.",
    "premium",
  ],
  [
    "fumero",
    "instagram",
    "Lifestyle post",
    "Schrijf een lifestyle Instagram post voor Fumero. Focus op wellness en ontspanning. Geen expliciete product mentions. Max 100 woorden.",
    "lifestyle",
  ],
  [
    "fumero",
    "tiktok",
    "Educational content",
    "Schrijf een TikTok script voor Fumero over {onderwerp}. Informatief, 18+, 30-60 seconden. Nederlandse captions.",
    "informatief",
  ],
  [
    "fumero",
    "instagram",
    "Promotie post",
    "Schrijf een Instagram promotie post voor Fumero. Actie: {actie}. Professioneel, discreet. Max 100 woorden + hashtags.",
    "promotie",
  ],
];

const tplCount = (
  db
    .prepare("SELECT COUNT(*) as c FROM content_templates WHERE klant = ?")
    .get("fumero") as { c: number }
).c;

if (tplCount === 0) {
  const ins = db.prepare(
    `INSERT INTO content_templates (klant, platform, naam, prompt, toon)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of fumeroTemplateSeed) {
    ins.run(...row);
  }
}

const automationSeedCount = (
  db.prepare("SELECT COUNT(*) as c FROM automation_tasks").get() as { c: number }
).c;

if (automationSeedCount === 0) {
  const ins = db.prepare(
    `INSERT INTO automation_tasks (
       task_key, title, description, schedule_kind, schedule_time, schedule_weekday,
       enabled, approval_required, integration
     ) VALUES (?,?,?,?,?,?,?,?,?)`
  );
  type Seed = [
    string,
    string,
    string,
    string,
    string,
    number | null,
    number,
    number,
    string,
  ];
  const seeds: Seed[] = [
    [
      "fumero_orders_daily",
      "Check Fumero orders",
      "Dagelijkse controle nieuwe orders (Playwright / site).",
      "daily",
      "09:00",
      null,
      1,
      1,
      "playwright",
    ],
    [
      "send_invoice_emails",
      "Send invoice emails",
      "Openstaande facturen mailen via Gmail API.",
      "daily",
      "09:30",
      null,
      1,
      1,
      "gmail",
    ],
    [
      "update_inventory",
      "Update inventory",
      "Voorraad bijwerken in SQLite / sheet.",
      "daily",
      "10:00",
      null,
      1,
      1,
      "sqlite",
    ],
    [
      "vendor_check_weekly",
      "Vendor check",
      "Wekelijkse leveranciers- en prijs-check.",
      "weekly",
      "08:00",
      1,
      1,
      1,
      "playwright",
    ],
    [
      "social_schedule_weekly",
      "Social media schedule",
      "Concept planning posts voor de week.",
      "weekly",
      "08:30",
      1,
      1,
      1,
      "slack",
    ],
    [
      "analytics_report_weekly",
      "Analytics report",
      "Wekelijks rapport (traffic / conversies).",
      "weekly",
      "09:00",
      1,
      1,
      1,
      "sqlite",
    ],
  ];
  for (const row of seeds) {
    ins.run(...row);
  }
}

export default db;
