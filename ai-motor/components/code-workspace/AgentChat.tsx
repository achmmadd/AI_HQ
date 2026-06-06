"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeDiffReview } from "@/components/code-workspace/CodeDiffReview";
import type { CodeSelectionContext } from "@/lib/code-agent/message-context";
import type { WriteProposal } from "@/lib/code-line-diff";
import { cn } from "@/lib/utils";
import {
  codeTerminalKey,
  useCodeTerminalStore,
} from "@/stores/useCodeTerminalStore";
import { useAuthSession } from "@/hooks/useAuthSession";

const EXECUTOR_OFFLINE_MSG =
  "Geen code-executor bereikbaar. Koppel je laptop via PC bridge of start de NUC executor.";

type Message = { role: "user" | "assistant"; content: string };

type StreamChunk = {
  type:
    | "text"
    | "tool_call"
    | "tool_result"
    | "write_proposal"
    | "done"
    | "error";
  content?: string;
  tool?: string;
  input?: Record<string, string>;
  result?: string;
  path?: string;
  before?: string;
  after?: string;
  changes?: string[];
  proposals?: string[];
  error?: string;
};

type MentionState = {
  query: string;
  startIndex: number;
};

export function AgentChat({
  klant,
  workspace,
  openFiles,
  filePaths,
  pendingSelection,
  onClearSelection,
  onFilesChanged,
}: {
  klant: string;
  workspace: string | null;
  openFiles: string[];
  filePaths: string[];
  pendingSelection?: CodeSelectionContext | null;
  onClearSelection?: () => void;
  onFilesChanged: (files: string[]) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState("");
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [proposals, setProposals] = useState<WriteProposal[]>([]);
  const [applying, setApplying] = useState(false);
  const [executorOffline, setExecutorOffline] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<
    Array<{ id: number; title: string; updated_at: string }>
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { role: sessionRole } = useAuthSession();
  const reviewWrites = sessionRole !== "admin";

  const terminalOutput = useCodeTerminalStore((s) =>
    workspace ? s.outputByKey[codeTerminalKey(klant, workspace)] ?? "" : ""
  );

  const folderPaths = useMemo(() => {
    const dirs = new Set<string>();
    for (const p of filePaths) {
      const parts = p.split("/");
      let acc = "";
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
        dirs.add(`${acc}/`);
      }
    }
    return [...dirs];
  }, [filePaths]);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const files = filePaths.filter((p) => p.toLowerCase().includes(q)).slice(0, 6);
    const folders = folderPaths.filter((p) => p.toLowerCase().includes(q)).slice(0, 4);
    return [...folders, ...files].slice(0, 8);
  }, [mention, filePaths, folderPaths]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activity, proposals]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mention?.query]);

  useEffect(() => {
    if (!workspace) {
      setSessionId(null);
      setSessions([]);
      setMessages([]);
      return;
    }
    void (async () => {
      const res = await fetch(
        `/api/code/sessions?klant=${encodeURIComponent(klant)}&workspace=${encodeURIComponent(workspace)}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        sessions?: Array<{ id: number; title: string; updated_at: string }>;
      };
      const list = data.sessions ?? [];
      setSessions(list);
      if (list[0] && !sessionId) {
        setSessionId(list[0].id);
      }
    })();
  }, [klant, workspace]);

  useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      const res = await fetch(`/api/code/sessions/${sessionId}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: Array<{ role: string; content: string; meta_json?: string | null }>;
      };
      const msgs = (data.messages ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      setMessages(msgs);
      const lastMeta = [...(data.messages ?? [])]
        .reverse()
        .find((m) => m.meta_json)?.meta_json;
      if (lastMeta) {
        try {
          const meta = JSON.parse(lastMeta) as { proposals?: WriteProposal[] };
          if (meta.proposals?.length) setProposals(meta.proposals);
        } catch {
          /* ignore */
        }
      }
    })();
  }, [sessionId]);

  async function newSession() {
    if (!workspace) return;
    const res = await fetch("/api/code/sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ klant, workspace, title: "Nieuwe sessie" }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { session?: { id: number; title: string; updated_at: string } };
    if (data.session) {
      setSessions((prev) => [data.session!, ...prev]);
      setSessionId(data.session.id);
      setMessages([]);
      setProposals([]);
    }
  }

  useEffect(() => {
    fetch("/api/code/executor-target", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setExecutorOffline(String(d.active ?? "none") === "none"))
      .catch(() => setExecutorOffline(true));
  }, []);

  function updateMentionState(value: string, cursor: number) {
    const before = value.slice(0, cursor);
    const atMatch = before.match(/@([^\s@]*)$/);
    if (atMatch) {
      setMention({
        query: atMatch[1] ?? "",
        startIndex: before.length - atMatch[0].length,
      });
    } else {
      setMention(null);
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    updateMentionState(value, cursor);
  }

  function insertMention(filePath: string) {
    if (!mention) return;
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, mention.startIndex);
    const after = input.slice(cursor);
    const next = `${before}@${filePath} ${after}`;
    setInput(next);
    setMention(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = before.length + filePath.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  async function applyProposal(id: string) {
    const proposal = proposals.find(
      (p) => p.id === id && p.status === "pending"
    );
    if (!proposal || !workspace) return;
    setApplying(true);
    try {
      const res = await fetch("/api/code/files", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klant,
          workspace,
          path: proposal.path,
          content: proposal.after,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "applied" } : p))
      );
      onFilesChanged([proposal.path]);
    } catch (e) {
      setActivity(`❌ Toepassen mislukt: ${String(e)}`);
    } finally {
      setApplying(false);
    }
  }

  async function applyAllProposals() {
    const pending = proposals.filter((p) => p.status === "pending");
    if (!workspace || pending.length === 0) return;
    setApplying(true);
    const applied: string[] = [];
    try {
      for (const proposal of pending) {
        const res = await fetch("/api/code/files", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            klant,
            workspace,
            path: proposal.path,
            content: proposal.after,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        applied.push(proposal.path);
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id ? { ...p, status: "applied" } : p
          )
        );
      }
      if (applied.length) onFilesChanged(applied);
    } catch (e) {
      setActivity(`❌ Toepassen mislukt: ${String(e)}`);
    } finally {
      setApplying(false);
    }
  }

  function rejectAllProposals() {
    setProposals((prev) =>
      prev.map((p) =>
        p.status === "pending" ? { ...p, status: "rejected" } : p
      )
    );
  }

  function rejectProposal(id: string) {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p))
    );
  }

  function upsertProposal(chunk: StreamChunk) {
    if (!chunk.path) return;
    setProposals((prev) => {
      const filtered = prev.filter(
        (p) => !(p.path === chunk.path && p.status === "pending")
      );
      return [
        ...filtered,
        {
          id: `${chunk.path}-${Date.now()}`,
          path: chunk.path!,
          before: chunk.before ?? "",
          after: chunk.after ?? "",
          status: "pending" as const,
        },
      ];
    });
    setActivity(`📝 Review: ${chunk.path}`);
  }

  async function sendMessage(extraTerminal?: boolean) {
    if (!input.trim() || !workspace || loading) return;

    let userMessage = input.trim();
    if (extraTerminal && terminalOutput.trim()) {
      userMessage = `${userMessage}\n\n@terminal`;
    }
    setInput("");
    setMention(null);
    setLoading(true);
    setActivity("");

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const created = await fetch("/api/code/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klant, workspace }),
      });
      if (created.ok) {
        const d = (await created.json()) as { session?: { id: number } };
        activeSessionId = d.session?.id ?? null;
        if (activeSessionId) setSessionId(activeSessionId);
      }
    }

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    const selection =
      pendingSelection?.text.trim() ? pendingSelection : null;
    onClearSelection?.();

    try {
      const res = await fetch("/api/code/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klant,
          workspace,
          message: userMessage,
          history,
          openFiles,
          selection,
          sessionId: activeSessionId,
          terminalOutput: extraTerminal ? terminalOutput.slice(-4000) : undefined,
          reviewWrites,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          bridge_setup_url?: string;
        };
        if (err.code === "executor_offline" || res.status === 503) {
          setExecutorOffline(true);
        }
        throw new Error(
          typeof err.error === "string" ? err.error : `HTTP ${res.status}`
        );
      }

      if (!res.body) throw new Error("Geen stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split("\n").filter(Boolean)) {
          try {
            const chunk = JSON.parse(line) as StreamChunk;
            if (chunk.type === "text" && chunk.content) {
              assistantText += chunk.content;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                  };
                } else {
                  next.push({ role: "assistant", content: assistantText });
                }
                return next;
              });
            } else if (chunk.type === "write_proposal" && chunk.path) {
              upsertProposal(chunk);
            } else if (chunk.type === "tool_call" && chunk.tool) {
              setActivity(
                `🔧 ${chunk.tool}${chunk.input ? `: ${JSON.stringify(chunk.input).slice(0, 50)}…` : ""}`
              );
            } else if (chunk.type === "done") {
              if (chunk.changes?.length) onFilesChanged(chunk.changes);
              if (!chunk.proposals?.length) setActivity("");
            } else if (chunk.type === "error") {
              setActivity(`❌ ${chunk.error ?? "fout"}`);
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${String(e)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-surface">
      <div className="shrink-0 border-b border-border px-3 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Motor Code</p>
          {workspace ? (
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => void newSession()}>
              + Sessie
            </Button>
          ) : null}
        </div>
        {workspace ? (
          <p className="font-mono text-xs text-text-secondary">{workspace}</p>
        ) : null}
        {sessions.length > 0 ? (
          <select
            className="w-full rounded border border-border bg-background px-2 py-1 text-[10px]"
            value={sessionId ?? ""}
            onChange={(e) => setSessionId(Number(e.target.value) || null)}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {s.updated_at?.slice(0, 16)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {executorOffline ? (
        <div className="shrink-0 border-b border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-text-primary">
          {EXECUTOR_OFFLINE_MSG}{" "}
          <Link
            href="/cowork?tab=bridge"
            className="text-accent underline-offset-2 hover:underline"
          >
            PC bridge instellen
          </Link>
          .
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-text-secondary mt-6">
            Beschrijf wat je wilt bouwen. Typ <span className="font-mono">@</span>{" "}
            voor een bestand, of selecteer code → Agent. Wijzigingen worden eerst
            ter review getoond.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${m.role === "user" ? "text-right" : ""}`}
          >
            <div
              className={`inline-block max-w-full rounded-lg px-3 py-2 text-left whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : "bg-surface-elevated text-text-primary"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {activity ? (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            {activity}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <CodeDiffReview
          proposals={proposals}
          applying={applying}
          onApply={(id) => void applyProposal(id)}
          onReject={rejectProposal}
          onApplyAll={() => void applyAllProposals()}
          onRejectAll={rejectAllProposals}
        />
        {pendingSelection ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate font-mono text-text-primary">
              Selectie: {pendingSelection.path}:{pendingSelection.startLine}-
              {pendingSelection.endLine}
            </span>
            <button
              type="button"
              className="shrink-0 text-text-secondary hover:text-text-primary"
              onClick={() => onClearSelection?.()}
              aria-label="Selectie verwijderen"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div className="relative flex gap-2">
          {terminalOutput.trim() ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="self-end text-[10px]"
              disabled={!workspace || loading}
              onClick={() => {
                setInput((v) => (v.trim() ? `${v}\n@terminal` : "@terminal "));
                textareaRef.current?.focus();
              }}
            >
              Terminal
            </Button>
          ) : null}
          {mention && mentionMatches.length > 0 ? (
            <div className="absolute bottom-full left-0 right-12 mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-lg">
              {mentionMatches.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  className={cn(
                    "block w-full truncate px-3 py-1.5 text-left font-mono text-xs",
                    i === mentionIndex
                      ? "bg-accent/15 text-accent"
                      : "text-text-primary hover:bg-surface"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(p);
                  }}
                >
                  @{p}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (mention && mentionMatches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) =>
                    Math.min(i + 1, mentionMatches.length - 1)
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insertMention(mentionMatches[mentionIndex] ?? mentionMatches[0]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMention(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            disabled={!workspace || loading}
            placeholder={
              workspace
                ? "Wat wil je bouwen? @ voor bestand…"
                : "Kies eerst een project…"
            }
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          />
          <Button
            type="button"
            disabled={!workspace || loading || !input.trim()}
            onClick={() => void sendMessage()}
            className="self-end"
          >
            {loading ? "…" : "→"}
          </Button>
        </div>
      </div>
    </div>
  );
}
