import { logAgentUsage } from "@/lib/agent-usage-log";

export type {
  ChatUsageDisplayKind,
  TokenUsage,
} from "@/lib/chat-usage-labels";
export {
  estimateTokens,
  estimatePromptTokens,
  chatUsageAgentLabel,
  chatUsageDisplayKind,
  chatUsageDisplayName,
  resolveUsageModel,
  usageCostEur,
  formatTokenUsageLine,
} from "@/lib/chat-usage-labels";

export function logMotorChatUsage(opts: {
  klant: string;
  afdeling?: string | null;
  model: string;
  agentLabel: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  prompt: string;
  response: string;
  success?: boolean;
}): void {
  logAgentUsage({
    agentLabel: opts.agentLabel,
    klant: opts.klant,
    afdeling: opts.afdeling ?? null,
    model: opts.model,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    durationMs: opts.durationMs,
    success: opts.success !== false,
    inputPreview: opts.prompt,
    outputPreview: opts.response,
  });
}
