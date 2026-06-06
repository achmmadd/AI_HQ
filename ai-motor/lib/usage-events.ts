/**
 * OpenMeter-shaped usage events (Sprint 2.1 / 2.3.2).
 * Stdout stub when OPENMETER_STUB=1; PG persist when USE_POSTGRES=1.
 */

import { getDrizzleDb } from "@/lib/db/drizzle/client";
import { usageEvents } from "@/lib/db/drizzle/schema";
import { shouldDualWrite } from "@/lib/db/pg-flags";
import { setPgWorkspaceContext } from "@/lib/db/pg-adapter";
import {
  resolveWorkspaceIdBySlug,
  workspaceSlugForKlant,
} from "@/lib/workspace-context";

export type OpenMeterTokenUsageEvent = {
  specversion: "1.0";
  type: "motor.llm.token_usage";
  id: string;
  time: string;
  source: "ai-motor/chat-stream";
  subject: string;
  data: {
    meter: "llm_tokens";
    klant: string;
    workspace_id?: string | null;
    conversation_id?: number | null;
    model: string;
    routing: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_eur: number;
    duration_ms: number;
    agent_label?: string;
    routing_plan?: string;
    success: boolean;
  };
};

function stubEnabled(): boolean {
  return process.env.OPENMETER_STUB?.trim() === "1";
}

function eventId(): string {
  return `motor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildOpenMeterTokenEvent(opts: {
  klant: string;
  workspaceId?: string | null;
  conversationId?: number | null;
  model: string;
  routing: string;
  promptTokens: number;
  completionTokens: number;
  costEur: number;
  durationMs: number;
  agentLabel?: string;
  routingPlan?: string;
  success?: boolean;
}): OpenMeterTokenUsageEvent {
  const prompt = Math.max(0, Number(opts.promptTokens) || 0);
  const completion = Math.max(0, Number(opts.completionTokens) || 0);
  return {
    specversion: "1.0",
    type: "motor.llm.token_usage",
    id: eventId(),
    time: new Date().toISOString(),
    source: "ai-motor/chat-stream",
    subject: opts.klant,
    data: {
      meter: "llm_tokens",
      klant: opts.klant,
      workspace_id: opts.workspaceId ?? null,
      conversation_id: opts.conversationId ?? null,
      model: opts.model,
      routing: opts.routing,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      cost_eur: opts.costEur,
      duration_ms: Math.max(0, Number(opts.durationMs) || 0),
      agent_label: opts.agentLabel,
      ...(opts.routingPlan ? { routing_plan: opts.routingPlan } : {}),
      success: opts.success !== false,
    },
  };
}

async function persistUsageEventPg(
  event: OpenMeterTokenUsageEvent
): Promise<void> {
  const db = getDrizzleDb();
  if (!db) return;

  const workspaceId =
    event.data.workspace_id ??
    (await resolveWorkspaceIdBySlug(workspaceSlugForKlant(event.data.klant)));

  if (workspaceId) {
    await setPgWorkspaceContext({ workspaceId });
  }

  await db.insert(usageEvents).values({
    workspaceId: workspaceId ?? null,
    eventId: event.id,
    eventType: event.type,
    eventTime: new Date(event.time),
    source: event.source,
    subject: event.subject,
    meter: event.data.meter,
    klant: event.data.klant,
    conversationId:
      event.data.conversation_id != null
        ? String(event.data.conversation_id)
        : null,
    model: event.data.model,
    routing: event.data.routing,
    promptTokens: event.data.prompt_tokens,
    completionTokens: event.data.completion_tokens,
    totalTokens: event.data.total_tokens,
    costEur: event.data.cost_eur,
    durationMs: event.data.duration_ms,
    agentLabel: event.data.agent_label ?? null,
    success: event.data.success,
    payloadJson: JSON.stringify(event),
  });
}

/** Log CloudEvents-shaped stub (stdout) and persist to PG when enabled. */
export function emitOpenMeterUsageStub(
  event: OpenMeterTokenUsageEvent
): void {
  if (stubEnabled()) {
    try {
      console.info("[openmeter-stub]", JSON.stringify(event));
    } catch {
      /* ignore */
    }
  }

  if (shouldDualWrite()) {
    void persistUsageEventPg(event).catch((err) => {
      console.error("[usage-events] PG usage_events write failed:", err);
    });
  }
}
