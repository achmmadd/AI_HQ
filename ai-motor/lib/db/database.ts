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
`);

export default db;
