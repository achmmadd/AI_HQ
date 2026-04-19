/**
 * Verwijdert Factory OS / metadata-ruis zodat chat-output dichter bij “clean assistant” blijft.
 * Wordt na envelope-stripping toegepast (zie extractMessage in chat-n8n).
 */
export function stripChatOutput(text: string): string {
  if (!text) return "";

  let clean = text;

  clean = clean.replace(/^Klant:[^\n]*\n?/gim, "");
  clean = clean.replace(/^Agent:[^\n]*\n?/gim, "");
  clean = clean.replace(/^Datum:[^\n]*\n?/gim, "");

  clean = clean.replace(
    /^#{1,3}\s*(Samenvatting|Volledige response|Factory OS Response|Actiepunten)[^\n]*\n?/gim,
    ""
  );

  clean = clean.replace(/^---\s*(?:_)?(?:Let op:|Factory OS)[^\n]*\n?/gim, "");
  clean = clean.replace(/^\*Factory OS[^*]*\*\s*\n?/gim, "");

  clean = clean.replace(/^\n+/, "").replace(/\n+$/, "");
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim();
}
