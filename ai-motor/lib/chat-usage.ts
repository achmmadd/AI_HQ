import { logAgentUsage } from "@/lib/agent-usage-log";
import {
  buildOpenMeterTokenEvent,
  emitOpenMeterUsageStub,
} from "@/lib/usage-events";

export type {
  ChatUsageDisplayKind,
  TokenUsage,
} from "@/lib/chat-usage-labels";
import {
  usageCostEur,
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
  routing?: string;
  routingPlan?: string;
  conversationId?: number | null;
  workspaceId?: string | null;
  costEur?: number;
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

  const costEur =
    opts.costEur ??
    usageCostEur(opts.model, opts.promptTokens, opts.completionTokens);
  emitOpenMeterUsageStub(
    buildOpenMeterTokenEvent({
      klant: opts.klant,
      workspaceId: opts.workspaceId,
      conversationId: opts.conversationId,
      model: opts.model,
      routing: opts.routing ?? opts.agentLabel,
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
      costEur,
      durationMs: opts.durationMs,
      agentLabel: opts.agentLabel,
      routingPlan: opts.routingPlan,
      success: opts.success !== false,
    })
  );
}
