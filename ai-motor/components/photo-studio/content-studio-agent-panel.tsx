"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Send, Square, Sparkles, X } from "lucide-react";
import { useMotorsChat } from "@/hooks/useMotorsChat";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import { FUMERO_CHAT_SUGGESTIONS } from "@/lib/fumero-quick-actions";
import { resolveMaxContentChatAction } from "@/lib/fumero/max-content-chat";
import type { ContentStudioMediaType } from "@/lib/photo-studio/types";
import type { ChatKlant } from "@/lib/types";
import { cn } from "@/lib/utils";

const ONBOARD_KEY = "fumero-studio-agent-onboarded";

type ConversationRow = {
  id: number;
  title?: string | null;
  updated_at?: string;
};

type Props = {
  klant: ChatKlant;
  onApplyToStudio?: (prompt: string, opts?: { mediaType?: ContentStudioMediaType }) => void;
};

/** Compact AI Agent chat for split Studio left pane — reuses Max chat APIs. */
export function ContentStudioAgentPanel({ klant, onApplyToStudio }: Props) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>(
    undefined
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    send,
    stop,
    streamingId,
    streamStatus,
    error,
    historyLoaded,
    clearError,
  } = useMotorsChat(klant, undefined, activeConversationId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowOnboarding(!localStorage.getItem(ONBOARD_KEY));
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    setShowOnboarding(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJsonChecked<{ conversations?: ConversationRow[] }>(
          `/api/conversations?klant=${encodeURIComponent(klant)}`,
          { credentials: "include" }
        );
        let rows = data.conversations ?? [];
        if (rows.length === 0) {
          const row = await fetchJsonChecked<ConversationRow>("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ klant }),
          });
          rows = [row];
        }
        if (cancelled) return;
        setConversations(rows);
        if (rows[0]?.id != null) setActiveConversationId(rows[0].id);
      } catch {
        /* graceful — chat still works once conversation exists */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [klant]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamingId]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streamingId || activeConversationId === undefined) return;
    clearError();
    setInput("");
    const action = resolveMaxContentChatAction(trimmed);
    await send(trimmed, { agentMode: true });
    if (action && onApplyToStudio) {
      const mediaType =
        action.contentType === "social_video" ? ("video" as const) : ("image" as const);
      onApplyToStudio(action.prompt, { mediaType });
    }
  }, [input, streamingId, activeConversationId, clearError, send, onApplyToStudio]);

  const startNewConversation = async () => {
    try {
      const row = await fetchJsonChecked<ConversationRow>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ klant }),
      });
      setConversations((prev) => [row, ...prev]);
      setActiveConversationId(row.id);
    } catch {
      /* ignore */
    }
  };

  const lastUserPrompt = [...messages].reverse().find((m) => m.role === "user")?.content;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {showOnboarding ? (
        <div className="relative rounded-lg border border-[var(--fumero-accent)]/30 bg-[var(--fumero-accent-muted)] px-3 py-2 text-[11px] text-[var(--fumero-text)]">
          <button
            type="button"
            className="absolute right-1.5 top-1.5 rounded p-0.5 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={dismissOnboarding}
            aria-label="Sluit tip"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="font-medium">AI Agent modus</p>
          <p className="mt-0.5 text-[var(--fumero-text-muted)]">
            Beschrijf wat je wilt maken — de agent helpt met prompts en stappen. Creatie-intent
            vult automatisch het Standaard-paneel in.
          </p>
        </div>
      ) : null}

      <div className="shrink-0">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-[var(--fumero-border)] px-2.5 py-1.5 text-[11px] text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
        >
          <span>Recente gesprekken ({conversations.length})</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", historyOpen && "rotate-180")}
          />
        </button>
        {historyOpen ? (
          <ul className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-[var(--fumero-border)] py-0.5 text-[11px]">
            {conversations.slice(0, 8).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cn(
                    "block w-full truncate px-2.5 py-1.5 text-left hover:bg-[var(--fumero-surface-muted)]",
                    activeConversationId === c.id && "bg-[var(--fumero-accent-muted)] font-medium"
                  )}
                  onClick={() => setActiveConversationId(c.id)}
                >
                  {c.title?.trim() || `Gesprek ${c.id}`}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="block w-full px-2.5 py-1.5 text-left text-[var(--fumero-accent)] hover:bg-[var(--fumero-surface-muted)]"
                onClick={() => void startNewConversation()}
              >
                + Nieuw gesprek
              </button>
            </li>
          </ul>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="min-h-[140px] flex-1 overflow-y-auto rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-2 space-y-2"
      >
        {!historyLoaded && activeConversationId !== undefined ? (
          <p className="text-center text-[11px] text-[var(--fumero-text-subtle)] py-6">Laden…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-[11px] text-[var(--fumero-text-muted)] py-6 px-2">
            Vraag de agent om een productfoto, social post of video-concept. Suggesties hieronder.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-[var(--fumero-accent-muted)] text-[var(--fumero-text)]"
                  : "mr-auto bg-[var(--fumero-surface-muted)] text-[var(--fumero-text)]"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.content || (streamingId === m.id ? "…" : "")}</p>
            </div>
          ))
        )}
        {streamStatus && streamingId ? (
          <p className="text-[10px] text-[var(--fumero-text-subtle)] px-1">{streamStatus}</p>
        ) : null}
      </div>

      {lastUserPrompt && onApplyToStudio ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 self-start rounded-full border border-[var(--fumero-border)] px-2.5 py-0.5 text-[10px] text-[var(--fumero-text-muted)] hover:border-[var(--fumero-accent)] hover:text-[var(--fumero-text)]"
          onClick={() => {
            const action = resolveMaxContentChatAction(lastUserPrompt);
            onApplyToStudio(
              action?.prompt ?? lastUserPrompt,
              action?.contentType === "social_video" ? { mediaType: "video" } : { mediaType: "image" }
            );
          }}
        >
          <Sparkles className="h-3 w-3" />
          Gebruik in Studio
        </button>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {FUMERO_CHAT_SUGGESTIONS.slice(0, 4).map((s) => (
          <button
            key={s.label}
            type="button"
            className="rounded-full border border-[var(--fumero-border)] px-2 py-0.5 text-[10px] text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={() => setInput(s.prompt)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-[10px] text-red-600 px-1">{error}</p>
      ) : null}

      <div className="flex shrink-0 items-end gap-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Vraag de AI Agent…"
          rows={2}
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-2 text-[12px] outline-none placeholder:text-[var(--fumero-text-muted)] focus:border-[var(--fumero-accent)] focus:ring-1 focus:ring-[var(--fumero-accent)]"
          disabled={activeConversationId === undefined}
        />
        {streamingId ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--fumero-border)] text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={() => stop()}
            aria-label="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--fumero-accent)] text-white hover:bg-[var(--fumero-accent-hover)] disabled:opacity-50"
            onClick={() => void handleSend()}
            disabled={!input.trim() || activeConversationId === undefined}
            aria-label="Verstuur"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
