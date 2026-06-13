import { getSessionMessages } from "@/lib/code-sessions";

const DEFAULT_LIMIT = 24;

/** Recent code-agent turns for progressive memory (layer 2). */
export function getCodeSessionTranscriptForMemory(
  sessionId: number,
  limit = DEFAULT_LIMIT
): { role: string; content: string }[] {
  const rows = getSessionMessages(sessionId);
  return rows.slice(-limit).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
