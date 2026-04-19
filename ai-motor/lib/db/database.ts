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
  if (!chatCols.some((c) => c.name === "conversation_id")) {
    db.exec(
      `ALTER TABLE chat_history ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)`
    );
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_klant ON conversations(klant);
    CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id);
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

export default db;
