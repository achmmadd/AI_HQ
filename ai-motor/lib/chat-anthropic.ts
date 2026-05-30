import { anthropicComplete } from "@/lib/anthropic-messages";
import type { ChatContextMsg } from "@/lib/chat-n8n";

function toAnthropicMessages(
  ctx: ChatContextMsg[],
  userPrompt: string
): { role: "user" | "assistant"; content: string }[] {
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of ctx) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content: m.content });
  }
  messages.push({ role: "user", content: userPrompt });
  return messages;
}

export async function runAnthropicChatTurn(opts: {
  system: string;
  context: ChatContextMsg[];
  userPrompt: string;
}): Promise<{ text: string; model: string }> {
  return anthropicComplete({
    system: opts.system,
    messages: toAnthropicMessages(opts.context, opts.userPrompt),
  });
}
