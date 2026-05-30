"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  countDiffChanges,
  diffText,
  type WriteProposal,
} from "@/lib/code-line-diff";
import { cn } from "@/lib/utils";

function DiffView({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => diffText(before, after), [before, after]);
  const { added, removed } = useMemo(() => countDiffChanges(lines), [lines]);

  if (before === after) {
    return (
      <p className="px-2 py-1 text-xs text-text-secondary">Geen wijzigingen</p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="px-2 text-[10px] text-text-secondary">
        +{added} / −{removed} regels
      </p>
      <pre className="max-h-48 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              line.type === "add" && "bg-green-500/15 text-green-700 dark:text-green-300",
              line.type === "remove" && "bg-red-500/15 text-red-700 dark:text-red-300",
              line.type === "same" && "text-text-secondary"
            )}
          >
            <span className="select-none opacity-60">
              {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
            </span>
            {line.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function CodeDiffReview({
  proposals,
  applying,
  onApply,
  onReject,
  onApplyAll,
  onRejectAll,
}: {
  proposals: WriteProposal[];
  applying: boolean;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
  onApplyAll: () => void;
  onRejectAll?: () => void;
}) {
  const pending = proposals.filter((p) => p.status === "pending");
  const [expanded, setExpanded] = useState<string | null>(
    pending[0]?.id ?? null
  );

  if (pending.length === 0) return null;

  return (
    <div className="mb-2 space-y-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-primary">
          Wijzigingen ter review ({pending.length})
        </p>
        {pending.length > 1 ? (
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              className="h-6 text-[10px]"
              disabled={applying}
              onClick={() => void onApplyAll()}
            >
              Alles toepassen
            </Button>
            {onRejectAll ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                disabled={applying}
                onClick={() => onRejectAll()}
              >
                Alles afwijzen
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {pending.map((p) => (
        <div
          key={p.id}
          className="rounded border border-border bg-surface p-2 space-y-2"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-mono text-xs text-text-primary"
              onClick={() =>
                setExpanded((id) => (id === p.id ? null : p.id))
              }
            >
              {expanded === p.id ? "▾" : "▸"} {p.path}
            </button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-6 text-[10px]"
              disabled={applying}
              onClick={() => void onApply(p.id)}
            >
              Toepassen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              disabled={applying}
              onClick={() => onReject(p.id)}
            >
              Afwijzen
            </Button>
          </div>
          {expanded === p.id ? (
            <DiffView before={p.before} after={p.after} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
