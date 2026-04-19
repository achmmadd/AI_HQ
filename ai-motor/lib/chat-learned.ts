import db from "@/lib/db/database";

const CHAT_LEARNED_KEY = "chat_learned_suffix";

export function getChatLearnedInstructionSuffix(): string {
  const row = db
    .prepare(`SELECT value FROM app_settings WHERE key = ?`)
    .get(CHAT_LEARNED_KEY) as { value: string } | undefined;
  const v = row?.value?.trim();
  if (!v) return "";
  return `\n\n[Actieve verbeter-instructies uit feedback/review — pas antwoorden hierop aan:]\n${v}\n`;
}

/** Voeg goedgekeurde suggestie toe aan de instructie die bij elke Factory-chat wordt meegestuurd. */
export function appendLearnedInstructionChunk(chunk: string): void {
  const t = chunk.trim();
  if (!t) return;
  const row = db
    .prepare(`SELECT value FROM app_settings WHERE key = ?`)
    .get(CHAT_LEARNED_KEY) as { value: string } | undefined;
  const prev = row?.value?.trim() ?? "";
  const next = prev ? `${prev}\n\n—\n${t}` : t;
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`
  ).run(CHAT_LEARNED_KEY, next);
}
