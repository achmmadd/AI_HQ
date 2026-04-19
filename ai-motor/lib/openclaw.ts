"use client";

import type { CompanyId } from "./types";

export async function sendChatMessage(
  prompt: string,
  klant: CompanyId,
  afdeling?: string
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, klant, afdeling }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}
