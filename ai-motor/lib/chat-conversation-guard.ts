import db from "@/lib/db/database";

export function assertConversationForKlant(
  klant: string,
  conversationId: number | null | undefined
): void {
  if (conversationId == null || !Number.isFinite(conversationId)) return;
  const row = db
    .prepare(`SELECT klant FROM conversations WHERE id = ?`)
    .get(conversationId) as { klant: string } | undefined;
  if (!row || row.klant !== klant) {
    throw new Error("Ongeldige conversatie voor deze klant");
  }
}
