"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatMessageStream } from "@/lib/openclaw";
import type { ChatMessage, CompanyId } from "@/lib/types";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type UseChatOptions = {
  /** Na een geslaagde stream: o.a. conversatielijst verversen voor autotitel. */
  onStreamComplete?: () => void;
};

export function useChat(
  company: CompanyId,
  afdeling?: string,
  conversationId?: number | null,
  opts?: UseChatOptions
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const onStreamCompleteRef = useRef(opts?.onStreamComplete);
  onStreamCompleteRef.current = opts?.onStreamComplete;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (conversationId === undefined) {
      setMessages([]);
      setHistoryLoaded(false);
      return;
    }

    let cancelled = false;
    setHistoryLoaded(false);
    setMessages([]);

    const url =
      conversationId === null
        ? `/api/chat/history?klant=${encodeURIComponent(company)}`
        : `/api/conversations/${conversationId}/messages?klant=${encodeURIComponent(company)}`;

    fetch(url)
      .then((r) => r.json())
      .then(
        (d: {
          messages?: Array<{
            id: number;
            role: string;
            content: string;
            created_at?: string;
            experiment_id?: number | null;
            experiment_variant?: string | null;
            experiment_name?: string | null;
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
            chatHistoryId:
              row.role === "assistant" ? row.id : undefined,
            experimentId:
              row.role === "assistant" &&
              typeof row.experiment_id === "number"
                ? row.experiment_id
                : undefined,
            experimentVariant:
              row.role === "assistant" &&
              (row.experiment_variant === "a" || row.experiment_variant === "b")
                ? row.experiment_variant
                : undefined,
            experimentName:
              row.role === "assistant" &&
              typeof row.experiment_name === "string"
                ? row.experiment_name
                : undefined,
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
  }, [company, conversationId]);

  const send = useCallback(
    async (prompt: string, optsSend?: { agentMode?: boolean }) => {
      if (conversationId === undefined) return;
      setError(null);
      const agentMode = optsSend?.agentMode ?? false;
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
        const meta = await sendChatMessageStream(
          prompt,
          company,
          afdeling,
          {
            agentMode,
            context: contextForApi,
            conversationId:
              conversationId === null ? undefined : conversationId,
          },
          (accumulated) => {
            setMessages((m) =>
              m.map((x) =>
                x.id === asstId ? { ...x, content: accumulated } : x
              )
            );
          }
        );
        const aid = meta.assistant_message_id;
        const eid = meta.experiment_id;
        const ev = meta.experiment_variant;
        const en = meta.experiment_name;
        if (typeof aid === "number" && Number.isFinite(aid)) {
          setMessages((m) =>
            m.map((x) =>
              x.id === asstId
                ? {
                    ...x,
                    chatHistoryId: aid,
                    experimentId:
                      typeof eid === "number" && Number.isFinite(eid)
                        ? eid
                        : undefined,
                    experimentVariant:
                      ev === "a" || ev === "b" ? ev : undefined,
                    experimentName:
                      typeof en === "string" ? en : undefined,
                  }
                : x
            )
          );
        }
        onStreamCompleteRef.current?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fout bij versturen");
        setMessages((m) =>
          m.map((x) =>
            x.id === asstId
              ? {
                  ...x,
                  content:
                    x.content ||
                    "Kon geen antwoord ophalen. Controleer n8n en de webhook.",
                }
              : x
          )
        );
      } finally {
        setStreamingId(null);
      }
    },
    [company, afdeling, conversationId]
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
