/**
 * Lichte heuristiek vóór ingest — geen garantie; UI toont waarschuwingen.
 */
export function validateKnowledgeText(text: string): {
  ok: boolean;
  error?: string;
  warnings: string[];
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Geen tekst om te indexeren.", warnings: [] };
  }
  if (trimmed.length < 30) {
    return {
      ok: false,
      error: "Tekst te kort om nuttig te chunken (min. ~30 tekens).",
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (/\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(trimmed)) {
    warnings.push("Mogelijk e-mailadres(sen) in tekst — controleer of publicatie OK is.");
  }
  if (/(\+31|0)[1-9][\d\s\-]{8,}/.test(trimmed)) {
    warnings.push("Mogelijk telefoonnummer — controleer privacy/compliance.");
  }
  if (/\b\d{9}\b/.test(trimmed)) {
    warnings.push("Lange cijferreeksen gevonden — mogelijk ID; controleer handmatig.");
  }

  return { ok: true, warnings };
}
