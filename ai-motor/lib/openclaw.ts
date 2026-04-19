"use client";

import type { CompanyId } from "./types";

export async function sendChatMessage(
  prompt: string,
  klant: CompanyId,
  afdeling?: string,
  options?: {
    agentMode?: boolean;
    context?: { role: string; content: string }[];
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
  klant: CompanyId,
  afdeling: string | undefined,
  options: {
    agentMode?: boolean;
    context?: { role: string; content: string }[];
  },
  onDelta: (accumulated: string) => void
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      klant,
      ...(afdeling ? { afdeling } : {}),
      agent_mode: options?.agentMode ?? false,
      context: options?.context ?? [],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Geen response stream");
  }

  const dec = new TextDecoder();
  let buf = "";
  let meta: Record<string, unknown> = {};
  let acc = "";

  while (true) {
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
      if (ev.type === "delta" && typeof ev.text === "string") {
        acc += ev.text;
        onDelta(acc);
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
}
