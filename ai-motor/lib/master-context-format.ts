/** Client-safe master context formatting (no DB imports). */

/** Format master context block for system preamble preview. */
export function formatMasterContextBlock(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  return `### Master Context (workspace)\n${trimmed}`;
}
