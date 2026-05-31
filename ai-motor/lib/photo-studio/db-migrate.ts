import db from "@/lib/db/database";

let done = false;

function columnExists(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return cols.some((c) => c.name === column);
}

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

  if (!columnExists("photo_studio_generations", "user_prompt")) {
    db.exec(`ALTER TABLE photo_studio_generations ADD COLUMN user_prompt TEXT`);
  }
  if (!columnExists("photo_studio_generations", "fal_prompt")) {
    db.exec(`ALTER TABLE photo_studio_generations ADD COLUMN fal_prompt TEXT`);
  }
  if (!columnExists("photo_studio_generations", "media_type")) {
    db.exec(
      `ALTER TABLE photo_studio_generations ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image'`
    );
  }

  db.exec(`
    UPDATE photo_studio_generations
    SET user_prompt = CASE
      WHEN user_prompt IS NOT NULL AND user_prompt != '' THEN user_prompt
      WHEN instr(prompt, char(10) || char(10) || 'Professional') > 0
        THEN substr(prompt, 1, instr(prompt, char(10) || char(10) || 'Professional') - 1)
      ELSE prompt
    END
    WHERE user_prompt IS NULL OR user_prompt = '';

    UPDATE photo_studio_generations
    SET fal_prompt = prompt
    WHERE fal_prompt IS NULL;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS content_studio_templates (
      id TEXT PRIMARY KEY,
      klant TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      platform TEXT NOT NULL,
      thumbnail_url TEXT,
      blocks_json TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '1:1',
      quality TEXT NOT NULL DEFAULT '2K',
      tags_json TEXT,
      is_recipe INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_content_studio_templates_klant
      ON content_studio_templates(klant, is_recipe, created_at DESC);
  `);

  done = true;
}
