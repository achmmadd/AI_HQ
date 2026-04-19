"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/useChat";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { ChatMarkdown } from "@/components/chat-markdown";
import { cn } from "@/lib/utils";

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
  const { messages, send, streamingId, error, historyLoaded } = useChat(company);
  const [text, setText] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollBottom = () =>
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

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
        "flex flex-col rounded-2xl border border-border bg-surface",
        embedded
          ? "h-full min-h-[280px]"
          : "h-[calc(100vh-8.5rem)]"
      )}
    >
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
              disabled={!!streamingId}
              onClick={() => void runQuick(a.prompt)}
            >
              {a.label}
            </Button>
          ))}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {!historyLoaded && messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-secondary">
              Geschiedenis laden…
            </p>
          )}
          {historyLoaded && messages.length === 0 && (
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
                  <ChatMarkdown content={m.content} variant={m.role === "user" ? "user" : "assistant"} />
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
          disabled={!!streamingId}
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
          disabled={!!streamingId}
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
          disabled={!!streamingId}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
