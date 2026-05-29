import db from "@/lib/db/database";

let done = false;

export function ensurePhotoStudioSchema(): void {
  if (done) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_studio_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT NOT NULL UNIQUE,
      klant TEXT NOT NULL,
      mode TEXT NOT NULL,
      prompt TEXT NOT NULL,
      source_image_url TEXT,
      seed INTEGER,
      master_url TEXT NOT NULL,
      master_path TEXT,
      workspace_preset TEXT,
      content_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photo_studio_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL,
      aspect TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      public_url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (generation_id) REFERENCES photo_studio_generations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_photo_studio_gen_klant
      ON photo_studio_generations(klant, created_at DESC);
  `);
  done = true;
}
