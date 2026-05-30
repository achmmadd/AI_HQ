/**
 * Anthropic Messages API met web_search tool (gedeeld: chat + builder).
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

function blocksText(data: Record<string, unknown>): string {
  const content = data.content as unknown;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content as { type?: string; text?: string }[]) {
    if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

export function isAnthropicWebSearchConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getAnthropicResearchModel(): string {
  return (
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.ANTHROPIC_CHAT_MODEL?.trim() ||
    "claude-sonnet-4-20250514"
  );
}

/**
 * Live webonderzoek via Anthropic web_search tool.
 * Retourneert lege string als geen key of API-fout.
 */
export async function runAnthropicWebSearch(opts: {
  query: string;
  maxUses?: number;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return "";

  const maxUses = Math.min(Math.max(opts.maxUses ?? 3, 1), 5);
  const timeoutMs = opts.timeoutMs ?? 90_000;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model: getAnthropicResearchModel(),
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: maxUses,
        },
      ],
      messages: [{ role: "user", content: opts.query.trim() }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return "";
  }
  if (!res.ok) return "";
  return blocksText(data).trim();
}
