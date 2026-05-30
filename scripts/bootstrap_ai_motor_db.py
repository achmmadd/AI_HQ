#!/usr/bin/env python3
"""Past ai-motor SQLite-schema bij (zelfde logica als lib/db/database.ts initDb) zonder Next te starten."""
import os
import sqlite3
from pathlib import Path

HOME = Path(os.environ.get("HOME", "/home/pietje"))
DB_PATH = HOME / "AI_HQ" / "data" / "ai-motor.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

SQL_EXPERIMENTS = """
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
"""

SQL_FEEDBACK_BLOCK = """
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
"""

SQL_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_conversations_klant ON conversations(klant);
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_experiment ON chat_history(experiment_id);
"""


def column_names(con: sqlite3.Connection, table: str):
    cur = con.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


def main() -> None:
    con = sqlite3.connect(DB_PATH)
    try:
        con.execute("PRAGMA foreign_keys = ON")
        con.executescript(SQL_EXPERIMENTS)
        cols = column_names(con, "chat_history")
        if "conversation_id" not in cols:
            con.execute(
                "ALTER TABLE chat_history ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)"
            )
        if "experiment_id" not in cols:
            con.execute(
                "ALTER TABLE chat_history ADD COLUMN experiment_id INTEGER REFERENCES experiments(id)"
            )
        if "experiment_variant" not in cols:
            con.execute(
                "ALTER TABLE chat_history ADD COLUMN experiment_variant TEXT"
            )
        if "latency_ms" not in cols:
            con.execute("ALTER TABLE chat_history ADD COLUMN latency_ms INTEGER")
        con.executescript(SQL_FEEDBACK_BLOCK)
        con.executescript(SQL_INDEXES)
        con.commit()
        print(f"OK: schema bijgewerkt op {DB_PATH}")
    finally:
        con.close()


if __name__ == "__main__":
    main()
