"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/useChat";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const company = useCompanyStore((s) => s.company);
  const { messages, send, streamingId, error } = useChat(company);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await send(t);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-2xl border border-border bg-surface">
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.length === 0 && (
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
                    <span className="animate-pulse">Bezig…</span>
                  </span>
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
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
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bericht…"
          className="flex-1 rounded-2xl"
          autoComplete="off"
        />
        <Button type="submit" size="icon" className="rounded-2xl shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
