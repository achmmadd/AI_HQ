import { CODE_AGENT_TOOLS } from "@/lib/code-agent/tools";
import { formatOpenRouterUserError } from "@/lib/openrouter-errors";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";
import { fetchOpenRouterCompletions } from "@/lib/openrouter-request";

export type OpenRouterToolCall = {
  id: string;
  name: string;
  input: Record<string, string>;
};

export type OpenRouterChatMessage =
  | { role: "user" | "assistant"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type OpenRouterCodeResponse = {
  text: string;
  toolCalls: OpenRouterToolCall[];
  finishReason: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
  assistantMessage: OpenRouterChatMessage;
};

function openRouterHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!.trim()}`,
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://motorsai.app",
    "X-Title": "MotorsAI Code",
  };
}

function toOpenAiTools() {
  return CODE_AGENT_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function parseToolInput(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")])
    );
  } catch {
    return {};
  }
}

export function isOpenRouterCodeConfigured(): boolean {
  return isOpenRouterDirectConfigured();
}

export async function createOpenRouterCodeMessage(opts: {
  system: string;
  messages: OpenRouterChatMessage[];
  model: string;
  maxTokens?: number;
}): Promise<OpenRouterCodeResponse> {
  if (!isOpenRouterDirectConfigured()) {
    throw new Error("OPENROUTER_API_KEY ontbreekt");
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [{ role: "system", content: opts.system.slice(0, 200_000) }, ...opts.messages],
    tools: toOpenAiTools(),
    max_tokens: opts.maxTokens ?? 8192,
  };

  if (opts.model === "openrouter/pareto-code") {
    const minScore = Number(process.env.MOTOR_CODE_MIN_CODING_SCORE || "0.65");
    if (Number.isFinite(minScore)) {
      body.min_coding_score = minScore;
    }
  }

  const { res, errorBody } = await fetchOpenRouterCompletions({
    headers: openRouterHeaders(),
    body,
    primaryModel: opts.model,
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    throw new Error(
      formatOpenRouterUserError(
        `OpenRouter ${res.status}: ${errorBody.slice(0, 400)}`
      )
    );
  }

  const raw = await res.text();

  const json = JSON.parse(raw) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = json.choices?.[0];
  const msg = choice?.message;
  const text = typeof msg?.content === "string" ? msg.content : "";
  const toolCalls =
    msg?.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: parseToolInput(tc.function.arguments),
    })) ?? [];

  const assistantMessage: OpenRouterChatMessage = toolCalls.length
    ? {
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          },
        })),
      }
    : { role: "assistant", content: text };

  return {
    text,
    toolCalls,
    finishReason: choice?.finish_reason ?? null,
    usage: {
      input_tokens: json.usage?.prompt_tokens,
      output_tokens: json.usage?.completion_tokens,
    },
    assistantMessage,
  };
}

export function buildOpenRouterToolResultMessages(
  toolCalls: OpenRouterToolCall[],
  results: string[]
): OpenRouterChatMessage[] {
  return toolCalls.map((tc, i) => ({
    role: "tool" as const,
    tool_call_id: tc.id,
    content: results[i] ?? "",
  }));
}
