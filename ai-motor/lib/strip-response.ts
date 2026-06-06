/**
 * Verwijdert Factory OS / metadata-ruis zodat chat-output dichter bij “clean assistant” blijft.
 * Wordt na envelope-stripping toegepast (zie extractMessage in chat-n8n).
 */
function dedupeConsecutiveLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let prevNorm = "";
  for (const line of lines) {
    const norm = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (norm && norm === prevNorm) continue;
    out.push(line);
    prevNorm = norm || prevNorm;
  }
  return out.join("\n");
}

export function stripChatOutput(text: string): string {
  if (!text) return "";

  let clean = text;

  clean = clean.replace(
    /^Klant:\s*[^\n]*(?:·\s*Agent:[^\n]*)?\n?/gim,
    ""
  );
  clean = clean.replace(/^Klant:[^\n]*\n?/gim, "");
  clean = clean.replace(/^Agent:[^\n]*\n?/gim, "");
  clean = clean.replace(/^Afdeling:[^\n]*\n?/gim, "");
  clean = clean.replace(/^Datum:[^\n]*\n?/gim, "");

  clean = clean.replace(
    /^#{1,3}\s*(Samenvatting|Volledige response|Factory OS Response|Actiepunten|Live\s+site[- ]?check)[^\n]*\n?/gim,
    ""
  );
  clean = clean.replace(
    /^\*{0,2}(Factory OS Response|Samenvatting|Volledige response|Live\s+site[- ]?check)\*{0,2}\s*:?\s*\n?/gim,
    ""
  );
  clean = clean.replace(/^Volledige response:\s*\n?/gim, "");
  clean = clean.replace(/^Live\s+site[- ]?check\s*\n?/gim, "");

  clean = clean.replace(/^---\s*(?:_)?(?:Let op:|Factory OS)[^\n]*\n?/gim, "");
  clean = clean.replace(/^\*Factory OS[^*]*\*\s*\n?/gim, "");

  clean = dedupeConsecutiveLines(clean);

  clean = clean.replace(/^\n+/, "").replace(/\n+$/, "");
  clean = clean.replace(/\n{3,}/g, "\n\n");

  const trimmed = clean.trim();
  const rawTrimmed = text.trim();
  if (!trimmed && rawTrimmed.length > 0) {
    return rawTrimmed;
  }
  return trimmed;
}
