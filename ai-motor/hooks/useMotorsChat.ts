"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import {
  chatThinkingLabel,
  motorRoutingLabel,
  motorStatusPhaseLabel,
} from "@/lib/chat-activity-messages";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";
import { sendChatMessageStream } from "@/lib/openclaw";
import type { ChatKlant } from "@/lib/types";
import type { MotorsChatMessage } from "@/lib/motors-chat-types";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type UseMotorsChatOptions = {
  onStreamComplete?: () => void;
};

/** useChat + AbortController stop voor MotorsAI chat UI. */
export function useMotorsChat(
  company: ChatKlant,
  afdeling?: string,
  conversationId?: number | null,
  opts?: UseMotorsChatOptions
) {
  const [messages, setMessages] = useState<MotorsChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamActivities, setStreamActivities] = useState<string[]>([]);
  const messagesRef = useRef<MotorsChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const onStreamCompleteRef = useRef(opts?.onStreamComplete);
  onStreamCompleteRef.current = opts?.onStreamComplete;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const onActivities = (e: Event) => {
      const steps = (e as CustomEvent<{ steps?: string[] }>).detail?.steps;
      if (Array.isArray(steps) && steps.length) {
        setStreamActivities(steps);
        setStreamStatus(
          steps[steps.length - 1] ?? chatThinkingLabel(company)
        );
      }
    };
    const onActivity = (e: Event) => {
      const label = (e as CustomEvent<{ label?: string }>).detail?.label;
      if (!label) return;
      setStreamActivities((prev) => {
        const next = [...prev, label];
        setStreamStatus(label);
        return next;
      });
    };
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent<{ label?: string; phase?: string }>).detail;
      const label =
        d?.label ?? motorStatusPhaseLabel(d?.phase, company);
      setStreamStatus(label);
    };
    const onRouting = (e: Event) => {
      const detail = (
        e as CustomEvent<{ routing?: string; model_badge?: string }>
      ).detail;
      setStreamStatus(
        motorRoutingLabel(detail?.routing, {
          klant: company,
          modelBadge: detail?.model_badge,
        })
      );
    };
    window.addEventListener("motors-chat-activities", onActivities);
    window.addEventListener("motors-chat-activity", onActivity);
    window.addEventListener("motors-chat-status", onStatus);
    window.addEventListener("motors-chat-routing", onRouting);
    return () => {
      window.removeEventListener("motors-chat-activities", onActivities);
      window.removeEventListener("motors-chat-activity", onActivity);
      window.removeEventListener("motors-chat-status", onStatus);
      window.removeEventListener("motors-chat-routing", onRouting);
    };
  }, []);

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

    fetchJsonChecked<{
      messages?: Array<{
        id: number;
        role: string;
        content: string;
        created_at?: string;
        experiment_id?: number | null;
        experiment_variant?: string | null;
        experiment_name?: string | null;
      }>;
    }>(url, { credentials: "include" })
      .then((d) => {
        if (cancelled) return;
        const rows = d.messages ?? [];
        const mapped: MotorsChatMessage[] = rows.map((row, i) => ({
          id: `db-${row.id}-${i}`,
          role: row.role === "user" ? "user" : "assistant",
          content: row.content,
          createdAt: row.created_at
            ? Date.parse(row.created_at)
            : Date.now(),
          chatHistoryId: row.role === "assistant" ? row.id : undefined,
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
        setMessages((prev) => {
          const optimistic = prev.filter((m) => !String(m.id).startsWith("db-"));
          if (optimistic.length === 0) return mapped;
          const seen = new Set(mapped.map((m) => `${m.role}\0${m.content}`));
          const extra = optimistic.filter(
            (m) => !seen.has(`${m.role}\0${m.content}`)
          );
          return [...mapped, ...extra].sort(
            (a, b) => a.createdAt - b.createdAt
          );
        });
      })
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

  const streamReply = useCallback(
    async (
      prompt: string,
      agentMode: boolean,
      optsStream?: {
        skipUserMessage?: boolean;
        planMode?: boolean;
        modelTier?: FumeroComposerModelTier;
        /** Prep-stappen (scrape) behouden bij start stream. */
        initialActivities?: string[];
      }
    ) => {
      if (conversationId === undefined) return;
      const contextForApi = messagesRef.current
        .filter((m) => m.content.trim() !== "")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const asstId = id();
      if (!optsStream?.skipUserMessage) {
        const userMsg: MotorsChatMessage = {
          id: id(),
          role: "user",
          content: prompt,
          createdAt: Date.now(),
        };
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
      } else {
        setMessages((m) => [
          ...m,
          {
            id: asstId,
            role: "assistant",
            content: "",
            createdAt: Date.now(),
          },
        ]);
      }
      setStreamingId(asstId);
      const seed = optsStream?.initialActivities?.filter(Boolean) ?? [];
      if (seed.length) {
        setStreamActivities(seed);
        setStreamStatus(seed[seed.length - 1] ?? chatThinkingLabel(company));
      } else {
        setStreamActivities([]);
        setStreamStatus(chatThinkingLabel(company));
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const meta = await sendChatMessageStream(
          prompt,
          company,
          afdeling,
          {
            agentMode,
            planMode: optsStream?.planMode,
            modelTier: optsStream?.modelTier,
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
          },
          ac.signal
        );
        const aid = meta.assistant_message_id;
        const eid = meta.experiment_id;
        const ev = meta.experiment_variant;
        const en = meta.experiment_name;
        const usageLine =
          typeof meta.usage_line === "string" ? meta.usage_line : undefined;
        const usageKind =
          meta.usage_kind === "motor" ||
          meta.usage_kind === "turbo" ||
          meta.usage_kind === "onderzoek" ||
          meta.usage_kind === "automation" ||
          meta.usage_kind === "lokaal"
            ? meta.usage_kind
            : undefined;
        const promptTokens =
          typeof meta.prompt_tokens === "number" ? meta.prompt_tokens : undefined;
        const completionTokens =
          typeof meta.completion_tokens === "number"
            ? meta.completion_tokens
            : undefined;
        const usageModel =
          typeof meta.usage_model === "string" ? meta.usage_model : undefined;

        setMessages((m) =>
          m.map((x) =>
            x.id === asstId
              ? {
                  ...x,
                  ...(typeof aid === "number" && Number.isFinite(aid)
                    ? { chatHistoryId: aid }
                    : {}),
                  experimentId:
                    typeof eid === "number" && Number.isFinite(eid)
                      ? eid
                      : undefined,
                  experimentVariant:
                    ev === "a" || ev === "b" ? ev : undefined,
                  experimentName:
                    typeof en === "string" ? en : undefined,
                  ...(usageLine ? { usageLine } : {}),
                  ...(usageKind ? { usageKind } : {}),
                  ...(promptTokens != null ? { promptTokens } : {}),
                  ...(completionTokens != null ? { completionTokens } : {}),
                  ...(usageModel ? { usageModel } : {}),
                }
              : x
          )
        );
        onStreamCompleteRef.current?.();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(
          e instanceof Error ? e.message : "Fout bij versturen"
        );
        setMessages((m) =>
          m.map((x) =>
            x.id === asstId
              ? {
                  ...x,
                  content:
                    x.content ||
                    "Kon geen antwoord ophalen. Probeer het opnieuw.",
                }
              : x
          )
        );
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        setStreamingId(null);
        setStreamStatus(null);
        setStreamActivities([]);
      }
    },
    [company, afdeling, conversationId]
  );

  const prependAssistantMessage = useCallback((content: string, stableId = "max-opening") => {
    setMessages((m) => {
      if (m.some((x) => x.id === stableId)) return m;
      const msg: MotorsChatMessage = {
        id: stableId,
        role: "assistant",
        content,
        createdAt: Date.now(),
      };
      const next = [msg, ...m];
      messagesRef.current = next;
      return next;
    });
  }, []);

  const appendAssistantMessage = useCallback(
    (content: string, extra?: Partial<MotorsChatMessage>) => {
      const msg: MotorsChatMessage = {
        id: id(),
        role: "assistant",
        content,
        createdAt: Date.now(),
        ...extra,
      };
      setMessages((m) => {
        const next = [...m, msg];
        messagesRef.current = next;
        return next;
      });
      return msg.id;
    },
    []
  );

  const updateMessage = useCallback(
    (messageId: string, patch: Partial<MotorsChatMessage>) => {
      setMessages((m) => {
        const next = m.map((x) => (x.id === messageId ? { ...x, ...patch } : x));
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  const appendUserMessage = useCallback((content: string) => {
    const userMsg: MotorsChatMessage = {
      id: id(),
      role: "user",
      content,
      createdAt: Date.now(),
    };
    setMessages((m) => {
      const next = [...m, userMsg];
      messagesRef.current = next;
      return next;
    });
    return userMsg.id;
  }, []);

  const send = useCallback(
    async (
      prompt: string,
      optsSend?: {
        agentMode?: boolean;
        skipUserMessage?: boolean;
        planMode?: boolean;
        modelTier?: FumeroComposerModelTier;
        initialActivities?: string[];
      }
    ) => {
      if (conversationId === undefined) return;
      setError(null);
      const agentMode = optsSend?.agentMode ?? false;
      await streamReply(prompt, agentMode, {
        skipUserMessage: optsSend?.skipUserMessage,
        planMode: optsSend?.planMode,
        modelTier: optsSend?.modelTier,
        initialActivities: optsSend?.initialActivities,
      });
    },
    [conversationId, streamReply]
  );

  const regenerate = useCallback(
    async (optsSend?: {
      agentMode?: boolean;
      planMode?: boolean;
      modelTier?: FumeroComposerModelTier;
    }) => {
      if (conversationId === undefined || streamingId) return;
      const msgs = messagesRef.current;
      let lastUserIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx < 0) return;
      const prompt = msgs[lastUserIdx].content.trim();
      if (!prompt) return;
      setError(null);
      setMessages(msgs.slice(0, lastUserIdx + 1));
      const agentMode = optsSend?.agentMode ?? false;
      await streamReply(prompt, agentMode, {
        skipUserMessage: true,
        planMode: optsSend?.planMode,
        modelTier: optsSend?.modelTier,
      });
    },
    [conversationId, streamingId, streamReply]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingId(null);
    setStreamStatus(null);
    setStreamActivities([]);
  }, []);

  return {
    messages,
    send,
    appendUserMessage,
    prependAssistantMessage,
    appendAssistantMessage,
    updateMessage,
    regenerate,
    stop,
    streamingId,
    streamStatus,
    streamActivities,
    error,
    historyLoaded,
    clear: () => setMessages([]),
    clearError: () => setError(null),
    reportError: (msg: string) => setError(msg),
  };
}
