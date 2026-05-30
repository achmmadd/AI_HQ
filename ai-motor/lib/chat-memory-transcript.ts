import db from "@/lib/db/database";

const DEFAULT_LIMIT = 48;

export function getChatTranscriptForMemory(
  conversationId: number,
  limit = DEFAULT_LIMIT
): { role: string; content: string }[] {
  const rows = db
    .prepare(
      `SELECT role, content FROM chat_history
       WHERE conversation_id = ?
       ORDER BY id ASC
       LIMIT ?`
    )
    .all(conversationId, limit) as { role: string; content: string }[];
  return rows;
}
