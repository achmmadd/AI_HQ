"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EvomapAgent } from "@/hooks/useEvomapSocket";

export interface ActivityMessage {
  id: string;
  agentName: string;
  text: string;
  status: string;
  timestamp: number;
}

const statusColors: Record<string, string> = {
  idle:     "var(--color-muted)",
  busy:     "var(--color-apple-amber)",
  success:  "var(--color-apple-green)",
  error:    "var(--color-apple-red)",
  thinking: "var(--color-apple-purple)",
};

const statusLabels: Record<string, string> = {
  idle:     "Inactief",
  busy:     "Bezig",
  success:  "Klaar",
  error:    "Fout",
  thinking: "Denkt…",
};

interface MessagesPanelProps {
  messages: ActivityMessage[];
  connected: boolean;
  agents: EvomapAgent[];
}

export function MessagesPanel({ messages, connected, agents }: MessagesPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const activeCount = agents.filter((a) => a.status !== "idle").length;

  return (
    <div className="relative z-10 flex flex-col h-full glass rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--color-glass-border-thin)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            Activiteit
          </h2>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            {activeCount} agent{activeCount !== 1 ? "s" : ""} actief
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: connected ? "var(--color-apple-green)" : "var(--color-apple-red)",
              boxShadow: connected ? "0 0 6px var(--color-apple-green)" : undefined,
            }}
          />
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 flex flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 items-center justify-center text-xs"
              style={{ color: "var(--color-muted)" }}
            >
              Wacht op agent-activiteit…
            </motion.div>
          ) : (
            messages.map((msg) => {
              const color = statusColors[msg.status] ?? statusColors.idle;
              const label = statusLabels[msg.status] ?? msg.status;
              const time = new Date(msg.timestamp).toLocaleTimeString("nl-NL", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="glass-thin rounded-xl px-3 py-2.5 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar */}
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: `${color.replace(")", " / 0.20)").replace("oklch(", "oklch(")}`, color }}
                      >
                        {msg.agentName.charAt(0).toUpperCase()}
                      </span>
                      <span
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--color-foreground)" }}
                      >
                        {msg.agentName}
                      </span>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${color.replace(")", " / 0.15)").replace("oklch(", "oklch(")}`,
                        color,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {msg.text && (
                    <p
                      className="text-xs leading-relaxed pl-7"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {msg.text}
                    </p>
                  )}
                  <span
                    className="text-[10px] pl-7 tabular-nums"
                    style={{ color: "var(--color-muted)", opacity: 0.6 }}
                  >
                    {time}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
