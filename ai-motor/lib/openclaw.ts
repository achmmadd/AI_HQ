"use client";

import { failedResponseToError } from "@/lib/fetch-json-client";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";
import type { ChatKlant } from "./types";

export async function sendChatMessage(
  prompt: string,
  klant: ChatKlant,
  afdeling?: string,
  options?: {
    agentMode?: boolean;
    context?: { role: string; content: string }[];
    conversationId?: number | null;
  }
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      klant,
      ...(afdeling ? { afdeling } : {}),
      agent_mode: options?.agentMode ?? false,
      context: options?.context ?? [],
      ...(typeof options?.conversationId === "number"
        ? { conversation_id: options.conversationId }
        : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/** SSE chat stream — tokens verschijnen terwijl de server chunked doorstuurt. */
export async function sendChatMessageStream(
  prompt: string,
  klant: ChatKlant,
  afdeling: string | undefined,
  options: {
    agentMode?: boolean;
    planMode?: boolean;
    modelTier?: FumeroComposerModelTier;
    context?: { role: string; content: string }[];
    conversationId?: number | null;
  },
  onDelta: (accumulated: string) => void,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      prompt,
      klant,
      ...(afdeling ? { afdeling } : {}),
      agent_mode: options?.agentMode ?? false,
      plan_mode: options?.planMode ?? false,
      ...(options?.modelTier ? { model_tier: options.modelTier } : {}),
      context: options?.context ?? [],
      ...(typeof options.conversationId === "number"
        ? { conversation_id: options.conversationId }
        : {}),
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw failedResponseToError(t, res.status);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    const t = await res.text();
    throw failedResponseToError(t, res.status);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Geen response stream");
  }

  const dec = new TextDecoder();
  let buf = "";
  let meta: Record<string, unknown> = {};
  let acc = "";

  try {
  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(line.slice(6).trim()) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (ev.type === "activities" && typeof window !== "undefined") {
        const steps = ev.steps;
        if (Array.isArray(steps)) {
          window.dispatchEvent(
            new CustomEvent("motors-chat-activities", {
              detail: {
                steps: steps.filter((s): s is string => typeof s === "string"),
              },
            }),
          );
        }
      }
      if (ev.type === "activity" && typeof window !== "undefined") {
        const label = typeof ev.label === "string" ? ev.label : "";
        if (label) {
          window.dispatchEvent(
            new CustomEvent("motors-chat-activity", { detail: { label } }),
          );
        }
      }
      if (ev.type === "status" && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("motors-chat-status", {
            detail: {
              phase: typeof ev.phase === "string" ? ev.phase : "thinking",
              label: typeof ev.label === "string" ? ev.label : undefined,
            },
          }),
        );
      }
      if (ev.type === "routing" && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("motors-chat-routing", {
            detail: {
              routing: typeof ev.routing === "string" ? ev.routing : undefined,
              ttft_ms: typeof ev.ttft_ms === "number" ? ev.ttft_ms : undefined,
              model_badge:
                typeof ev.model_badge === "string"
                  ? ev.model_badge
                  : undefined,
            },
          }),
        );
      }
      if (ev.type === "delta" && typeof ev.text === "string") {
        acc += ev.text;
        onDelta(acc);
      }
      if (ev.type === "local_action" && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("motors-local-action", {
            detail: {
              op: typeof ev.op === "string" ? ev.op : undefined,
              label:
                typeof ev.label === "string" ? ev.label : "Actie op NUC",
            },
          }),
        );
      }
      if (ev.type === "agent_live" && typeof window !== "undefined") {
        const dbg = ev.debugger_fullscreen_url;
        const sid = ev.session_id;
        const detail = {
          debuggerFullscreenUrl:
            typeof dbg === "string" && dbg.trim() ? dbg.trim() : undefined,
          sessionId:
            typeof sid === "string" && sid.trim() ? sid.trim() : undefined,
        };
        window.dispatchEvent(
          new CustomEvent("agent-live-view", { detail }),
        );
      }
      if (ev.type === "done") {
        meta = ev;
      }
      if (ev.type === "error") {
        const msg =
          typeof ev.message === "string" ? ev.message : "Streamfout";
        const detail =
          typeof ev.detail === "string" ? `\n${ev.detail}` : "";
        throw new Error(msg + detail);
      }
    }
  }

  return meta;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}
