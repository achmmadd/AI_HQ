"use client";

import { useCallback, useState } from "react";
import { sendChatMessage } from "@/lib/openclaw";
import type { ChatMessage, CompanyId } from "@/lib/types";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(company: CompanyId, afdeling?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (prompt: string) => {
      setError(null);
      const userMsg: ChatMessage = {
        id: id(),
        role: "user",
        content: prompt,
        createdAt: Date.now(),
      };
      const asstId = id();
      setMessages((m) => [
        ...m,
        userMsg,
        {
          id: asstId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
        },
      ]);
      setStreamingId(asstId);
      try {
        const data = await sendChatMessage(prompt, company, afdeling);
        const text =
          (typeof data.output === "string" && data.output) ||
          (typeof data.answer_raw === "string" && data.answer_raw) ||
          JSON.stringify(data, null, 2);
        setMessages((m) =>
          m.map((x) => (x.id === asstId ? { ...x, content: text } : x))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fout bij versturen");
        setMessages((m) =>
          m.map((x) =>
            x.id === asstId
              ? {
                  ...x,
                  content:
                    "Kon geen antwoord ophalen. Controleer n8n en de webhook.",
                }
              : x
          )
        );
      } finally {
        setStreamingId(null);
      }
    },
    [company, afdeling]
  );

  return { messages, send, streamingId, error, clear: () => setMessages([]) };
}
