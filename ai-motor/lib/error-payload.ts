/** Zuivere JSON-shape voor fouten (ook bruikbaar in tests zonder Next). */

export function buildErrorPayload(
  message: string,
  detail?: string | null
): { error: string; detail?: string } {
  if (detail) {
    return { error: message, detail };
  }
  return { error: message };
}
