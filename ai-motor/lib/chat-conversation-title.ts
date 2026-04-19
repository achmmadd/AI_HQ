import db from "@/lib/db/database";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";

/** Eerste bericht → korte titel via Factory OS (max ~5 woorden); niet awaiten in de request. */
export function scheduleConversationTitleUpdate(
  conversationId: number,
  klant: string,
  firstUserMessage: string
): void {
  void (async () => {
    try {
      const { ok, data } = await callFactoryN8n({
        prompt: `Geef alleen een korte titel (maximaal 5 woorden, Nederlands) voor een chat die begint met dit bericht. Geen aanhalingstekens, geen uitleg, alleen de titel:\n${firstUserMessage.slice(0, 500)}`,
        klant,
        afdeling: "fabriek",
      });
      if (!ok || !data) return;
      let title = extractMessage(data)
        .split("\n")[0]
        .replace(/^["'“”\s]+|["'“”\s]+$/g, "")
        .trim()
        .slice(0, 120);
      if (!title) return;
      db.prepare(
        `UPDATE conversations SET title = ?, updated_at = datetime('now')
         WHERE id = ? AND title = 'Nieuwe chat'`
      ).run(title, conversationId);
    } catch {
      /* ignore */
    }
  })();
}
