"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatMessage } from "@/lib/openclaw";
import type { ChatMessage, CompanyId } from "@/lib/types";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(company: CompanyId, afdeling?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chat/history?klant=${encodeURIComponent(company)}`)
      .then((r) => r.json())
      .then(
        (d: {
          messages?: Array<{
            id: number;
            role: string;
            content: string;
            created_at?: string;
          }>;
        }) => {
          if (cancelled) return;
          const rows = d.messages ?? [];
          const mapped: ChatMessage[] = rows.map((row, i) => ({
            id: `db-${row.id}-${i}`,
            role: row.role === "user" ? "user" : "assistant",
            content: row.content,
            createdAt: row.created_at
              ? Date.parse(row.created_at)
              : Date.now(),
          }));
          setMessages(mapped);
        }
      )
      .catch(() => {
        /* optioneel */
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  const send = useCallback(
    async (prompt: string, opts?: { agentMode?: boolean }) => {
      setError(null);
      const agentMode = opts?.agentMode ?? false;
      const contextForApi = messagesRef.current
        .filter((m) => m.content.trim() !== "")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

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
        const data = await sendChatMessage(
          prompt,
          company,
          afdeling,
          {
            agentMode,
            context: contextForApi,
          }
        );
        const text =
          (typeof data.message === "string" && data.message) ||
          (typeof data.output === "string" && data.output) ||
          (typeof data.answer === "string" && data.answer) ||
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

  return {
    messages,
    send,
    streamingId,
    error,
    historyLoaded,
    clear: () => setMessages([]),
  };
}
