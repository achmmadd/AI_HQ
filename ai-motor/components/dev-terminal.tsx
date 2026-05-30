"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Line = {
  id: string;
  kind: "in" | "out" | "err" | "meta";
  text: string;
};

type Preset = { label: string; command: string };

export function DevTerminal() {
  const [cwd, setCwd] = useState("~");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const append = useCallback((entries: Omit<Line, "id">[]) => {
    setLines((prev) => [
      ...prev,
      ...entries.map((e, i) => ({
        ...e,
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    ]);
  }, []);

  useEffect(() => {
    fetch("/api/dev/terminal", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { cwd?: string; presets?: Preset[]; hint?: string }) => {
        if (j.cwd) setCwd(j.cwd);
        if (j.presets) setPresets(j.presets);
        if (j.hint) {
          append([{ kind: "meta", text: j.hint }]);
        }
        append([
          {
            kind: "meta",
            text: `Werkmap: ${j.cwd ?? "—"} · bash -lc · pm2, nano, export, nvm`,
          },
        ]);
      })
      .catch(() => {
        append([
          {
            kind: "err",
            text: "Terminal-info laden mislukt — ben je ingelogd?",
          },
        ]);
      });
  }, [append]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  const run = useCallback(
    async (command: string) => {
      const cmd = command.trim();
      if (!cmd || busy) return;
      setBusy(true);
      append([{ kind: "in", text: `$ ${cmd}` }]);
      setInput("");
      try {
        const res = await fetch("/api/dev/terminal", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: cmd, cwd }),
        });
        const j = (await res.json()) as {
          stdout?: string;
          stderr?: string;
          exit_code?: number | null;
          cwd?: string;
          duration_ms?: number;
          truncated?: boolean;
          error?: string;
        };
        if (!res.ok) {
          append([{ kind: "err", text: j.error ?? res.statusText }]);
          return;
        }
        if (j.cwd) setCwd(j.cwd);
        if (j.stdout?.trim()) {
          append([{ kind: "out", text: j.stdout.trimEnd() }]);
        }
        if (j.stderr?.trim()) {
          append([{ kind: "err", text: j.stderr.trimEnd() }]);
        }
        const code = j.exit_code ?? "?";
        append([
          {
            kind: "meta",
            text: `exit ${code} · ${j.duration_ms ?? 0}ms${j.truncated ? " · output afgekapt" : ""}`,
          },
        ]);
      } catch (e) {
        append([
          {
            kind: "err",
            text: e instanceof Error ? e.message : "Uitvoeren mislukt",
          },
        ]);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [append, busy, cwd]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 rounded-lg text-[12px]"
            disabled={busy}
            onClick={() => void run(p.command)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 rounded-lg text-[12px]"
          disabled={busy}
          onClick={() => setLines([])}
        >
          Wis scherm
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[min(56vh,520px)] min-h-[280px] overflow-y-auto rounded-xl border border-border bg-[#0d0d0f] p-3 font-mono text-[12px] leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <pre
            key={line.id}
            className={cn(
              "whitespace-pre-wrap break-words",
              line.kind === "in" && "text-green-400",
              line.kind === "out" && "text-slate-200",
              line.kind === "err" && "text-red-400",
              line.kind === "meta" && "text-slate-500"
            )}
          >
            {line.text}
          </pre>
        ))}
        {busy && (
          <p className="text-slate-500 animate-pulse">…</p>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(input);
        }}
      >
        <span className="flex shrink-0 items-center rounded-lg border border-border bg-surface px-2 font-mono text-[11px] text-text-secondary">
          bash
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="bijv. nano .env.local  of  export OPENROUTER_API_KEY=sk-…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[13px] text-text-primary outline-none focus:border-accent/50"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" className="rounded-lg" disabled={busy || !input.trim()}>
          Run
        </Button>
      </form>

      <p className="text-[11px] text-text-secondary">
        Draait op de NUC als gebruiker <code className="text-[10px]">pietje</code>.
        Voor API-keys:{" "}
        <code className="text-[10px]">cd ~/AI_HQ/ai-motor && nano .env.local</code>
        , daarna <code className="text-[10px]">pm2 restart ecosystem.config.cjs --update-env</code>.
        Geen interactieve editors zoals vim in de browser — gebruik{" "}
        <code className="text-[10px]">nano</code> of stel keys in via{" "}
        <code className="text-[10px]">echo VAR=waarde &gt;&gt; .env.local</code>.
      </p>
    </div>
  );
}
