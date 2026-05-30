import { getAnthropicApiKey } from "@/lib/anthropic-messages";
import { CODE_AGENT_TOOLS } from "@/lib/code-agent/tools";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
    };

export type AnthropicMessageParam = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type AnthropicResponse = {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export async function createAnthropicMessage(opts: {
  system: string;
  messages: AnthropicMessageParam[];
  model: string;
  maxTokens?: number;
}): Promise<AnthropicResponse> {
  const key = getAnthropicApiKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8192,
      system: opts.system.slice(0, 200_000),
      tools: CODE_AGENT_TOOLS,
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 400)}`);
  }
  return JSON.parse(raw) as AnthropicResponse;
}

export function extractTextBlocks(content: AnthropicContentBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function extractToolUseBlocks(content: AnthropicContentBlock[]): Array<{
  id: string;
  name: string;
  input: Record<string, string>;
}> {
  return content
    .filter(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        b.type === "tool_use"
    )
    .map((b) => ({
      id: b.id,
      name: b.name,
      input: Object.fromEntries(
        Object.entries(b.input).map(([k, v]) => [k, String(v ?? "")])
      ),
    }));
}
