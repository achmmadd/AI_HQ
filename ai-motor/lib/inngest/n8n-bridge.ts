/**
 * Inngest ↔ n8n bridge (Sprint 2.2).
 * Keeps legacy n8n computer-use flows working while new durable workflows use Inngest.
 */

import { sendInngestEvent } from "@/lib/inngest/client";
import { INNGEST_EVENTS, type N8nRelayData } from "@/lib/inngest/events";

export type N8nRelayResult = {
  inngest: Awaited<ReturnType<typeof sendInngestEvent>>;
  n8n?: { ok: boolean; status?: number; error?: string };
};

/** Accept an n8n webhook payload and emit a durable Inngest event. */
export async function relayN8nWebhookToInngest(
  body: Record<string, unknown>
): Promise<N8nRelayResult> {
  const data: N8nRelayData = {
    workflow:
      typeof body.workflow === "string"
        ? body.workflow
        : typeof body.workflowName === "string"
          ? body.workflowName
          : undefined,
    runId:
      typeof body.runId === "string"
        ? body.runId
        : typeof body.executionId === "string"
          ? body.executionId
          : undefined,
    payload: body,
  };

  const inngest = await sendInngestEvent(INNGEST_EVENTS.n8nRelay, data, {
    id: data.runId ? `n8n-${data.runId}` : undefined,
  });

  return { inngest };
}

/** Forward an Inngest step payload to an n8n webhook (computer-use / legacy flows). */
export async function forwardInngestToN8n(
  webhookUrl: string,
  payload: Record<string, unknown>,
  opts?: { timeoutMs?: number }
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = webhookUrl.trim();
  if (!url) {
    return { ok: false, error: "empty webhook url" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        source: "motor-inngest-bridge",
      }),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 60_000),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: `n8n ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Resolve n8n target for computer-use relay (Factory or dedicated agent webhook). */
export function resolveN8nBridgeWebhookUrl(): string | null {
  const candidates = [
    process.env.N8N_AGENT_WEBHOOK,
    process.env.N8N_AGENT_CHAT_WEBHOOK,
    process.env.MOTOR_AGENT_CHAT_WEBHOOK,
    process.env.COMPUTER_USE_URL,
    process.env.N8N_FACTORY_OS_WEBHOOK,
    process.env.N8N_FACTORY_WEBHOOK,
  ];

  for (const raw of candidates) {
    const url = raw?.trim();
    if (url) return url;
  }
  return null;
}
