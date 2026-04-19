"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Paperclip, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/useChat";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { ChatMarkdown } from "@/components/chat-markdown";
import { MessageFeedback } from "@/components/message-feedback";
import { cn } from "@/lib/utils";

type ConversationRow = {
  id: number;
  klant: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const QUICK_ACTIONS = [
  { label: "Samenvatting", prompt: "Geef een korte samenvatting van wat we bespraken." },
  { label: "Actiepunten", prompt: "Lijst concrete actiepunten met eigenaar en deadline." },
  { label: "Agenda", prompt: "Wat staat er komende week op de agenda voor dit bedrijf?" },
];

type SpeechRecCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function ChatPanel({ embedded = false }: { embedded?: boolean }) {
  const company = useCompanyStore((s) => s.company);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | undefined
  >(undefined);

  const refreshConversations = useCallback(async () => {
    const res = await fetch(
      `/api/conversations?klant=${encodeURIComponent(company)}`
    );
    const data = (await res.json()) as { conversations?: ConversationRow[] };
    const rows = data.conversations ?? [];
    setConversations(rows);
    return rows;
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    setActiveConversationId(undefined);
    setConversations([]);
    (async () => {
      const res = await fetch(
        `/api/conversations?klant=${encodeURIComponent(company)}`
      );
      const data = (await res.json()) as { conversations?: ConversationRow[] };
      let rows = data.conversations ?? [];
      if (rows.length === 0) {
        const post = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klant: company }),
        });
        if (post.ok) {
          const row = (await post.json()) as ConversationRow;
          rows = [row];
        }
      }
      if (cancelled) return;
      setConversations(rows);
      if (rows[0]) setActiveConversationId(rows[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [company]);

  const { messages, send, streamingId, error, historyLoaded } = useChat(
    company,
    undefined,
    activeConversationId,
    { onStreamComplete: () => void refreshConversations() }
  );

  const [text, setText] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollBottom = () =>
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

  const newChat = async () => {
    if (streamingId) return;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ klant: company }),
    });
    if (!res.ok) return;
    const row = (await res.json()) as ConversationRow;
    setConversations((prev) => [row, ...prev]);
    setActiveConversationId(row.id);
  };

  const deleteConversation = async (id: number) => {
    if (streamingId) return;
    const res = await fetch(
      `/api/conversations/${id}?klant=${encodeURIComponent(company)}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeConversationId === id) {
      if (remaining[0]) {
        setActiveConversationId(remaining[0].id);
      } else {
        const post = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klant: company }),
        });
        if (post.ok) {
          const row = (await post.json()) as ConversationRow;
          setConversations([row]);
          setActiveConversationId(row.id);
        } else {
          setActiveConversationId(undefined);
        }
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || streamingId) return;
    setText("");
    await send(t, { agentMode });
    scrollBottom();
  };

  const runQuick = async (prompt: string) => {
    if (streamingId) return;
    setText("");
    await send(prompt, { agentMode });
    scrollBottom();
  };

  const startVoice = useCallback(() => {
    if (typeof window === "undefined") return;
    const W = window as unknown as { webkitSpeechRecognition?: SpeechRecCtor; SpeechRecognition?: SpeechRecCtor };
    const Ctor = W.webkitSpeechRecognition || W.SpeechRecognition;
    if (!Ctor) {
      setText((t) => t + (t ? " " : "") + "[Spraak niet ondersteund in deze browser]");
      return;
    }
    const rec = new Ctor();
    rec.lang = "nl-NL";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript?.trim() ?? "";
      if (said) setText((prev) => (prev ? `${prev} ${said}` : said));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("klant", company);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { analysis?: string; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const summary =
        typeof data.analysis === "string" ? data.analysis : "Upload gelukt.";
      const msg = `Ik heb het bestand "${file.name}" geüpload. Analyse: ${summary}`;
      await send(msg, { agentMode });
      scrollBottom();
    } catch (err) {
      setText((t) =>
        t +
        (t ? "\n" : "") +
        (err instanceof Error ? err.message : "Upload mislukt")
      );
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-0 rounded-2xl border border-border bg-surface",
        embedded
          ? "h-full min-h-[280px]"
          : "h-[calc(100vh-8.5rem)]"
      )}
    >
      <aside
        className={cn(
          "flex min-h-0 w-52 shrink-0 flex-col border-r border-border bg-surface-elevated/40",
          embedded && "w-44"
        )}
      >
        <div className="border-b border-border p-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full rounded-xl text-xs"
            disabled={!!streamingId || activeConversationId === undefined}
            onClick={() => void newChat()}
          >
            + Nieuwe chat
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="p-1.5 space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-2 py-2 pr-8 text-left text-xs leading-snug transition-colors hover:bg-surface-elevated",
                    activeConversationId === c.id &&
                      "bg-surface-elevated underline decoration-accent decoration-2 underline-offset-4"
                  )}
                  onClick={() => setActiveConversationId(c.id)}
                >
                  <span className="line-clamp-2">{c.title}</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-secondary opacity-0 transition-opacity hover:bg-border hover:text-text-primary group-hover:opacity-100"
                  )}
                  title="Verwijderen"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConversation(c.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col min-h-0">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-b border-border px-4 py-2",
          embedded && "py-1.5"
        )}
      >
        <Button
          type="button"
          variant={agentMode ? "default" : "secondary"}
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setAgentMode((a) => !a)}
          title="Agent-modus: meer stappen via Factory OS / n8n"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Agent {agentMode ? "aan" : "uit"}
        </Button>
        {!embedded &&
          QUICK_ACTIONS.map((a) => (
            <Button
              key={a.label}
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl text-xs"
              disabled={
                !!streamingId || activeConversationId === undefined
              }
              onClick={() => void runQuick(a.prompt)}
            >
              {a.label}
            </Button>
          ))}
      </div>

      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {(activeConversationId === undefined ||
            (!historyLoaded && messages.length === 0)) && (
            <p className="py-8 text-center text-sm text-text-secondary">
              {activeConversationId === undefined
                ? "Conversaties laden…"
                : "Geschiedenis laden…"}
            </p>
          )}
          {activeConversationId !== undefined &&
            historyLoaded &&
            messages.length === 0 && (
            <p className="py-12 text-center text-sm text-text-secondary">
              Stuur een bericht naar de factory-os webhook via de server. Geen
              keys in de browser.
            </p>
          )}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "bg-accent text-white"
                    : "bg-surface-elevated text-text-primary"
                )}
              >
                {streamingId === m.id &&
                m.role === "assistant" &&
                !m.content ? (
                  <span className="inline-flex gap-1 text-text-secondary">
                    <span className="animate-pulse">Factory OS antwoordt…</span>
                  </span>
                ) : (
                  <>
                    <ChatMarkdown content={m.content} variant={m.role === "user" ? "user" : "assistant"} />
                    {m.role === "assistant" && m.experimentVariant && (
                      <p className="mt-1.5 text-[10px] uppercase tracking-wide text-text-secondary">
                        A/B · variant {m.experimentVariant}
                        {m.experimentName ? ` · ${m.experimentName}` : ""}
                      </p>
                    )}
                    {m.role === "assistant" &&
                      m.chatHistoryId != null &&
                      m.content.trim() !== "" && (
                        <MessageFeedback
                          messageId={m.chatHistoryId}
                          klant={company}
                        />
                      )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      {error && (
        <p className="border-t border-border px-4 py-2 text-xs text-error">
          {error}
        </p>
      )}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-border p-4"
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => void onFile(e)}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="rounded-2xl shrink-0"
          title="Bestand uploaden"
          onClick={() => fileRef.current?.click()}
          disabled={
            !!streamingId || activeConversationId === undefined
          }
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn("rounded-2xl shrink-0", listening && "ring-2 ring-accent")}
          title="Spraak (Web Speech API)"
          onClick={startVoice}
          disabled={
            !!streamingId || activeConversationId === undefined
          }
        >
          <Mic className="h-4 w-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bericht…"
          className="flex-1 rounded-2xl"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-2xl shrink-0"
          disabled={!!streamingId || activeConversationId === undefined}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      </div>
    </div>
  );
}
