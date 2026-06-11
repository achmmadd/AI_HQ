"use client";

import { useEffect, useState, type ComponentType } from "react";
import { X } from "lucide-react";
import type { FumeroBriefingPayload } from "@/lib/fumero/briefing";
import { formatBriefingTime } from "@/lib/fumero/max-briefing-chat";
import { cn } from "@/lib/utils";

type MotionAsideProps = {
  className?: string;
  role?: string;
  "aria-labelledby"?: string;
  initial?: { x: string };
  animate?: { x: number };
  exit?: { x: string };
  transition?: { duration: number; ease: string };
  children: React.ReactNode;
};

function Section({
  title,
  dotClass,
  items,
  onSelect,
}: {
  title: string;
  dotClass: string;
  items: string[];
  onSelect: (text: string) => void;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--fumero-text-muted)]">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--fumero-text-muted)]">Geen items.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item}>
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-2 text-left text-sm text-[var(--fumero-text)] transition-colors hover:border-[var(--fumero-success-border)] hover:bg-[var(--fumero-surface-muted)]"
                onClick={() => onSelect(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MaxBriefingDetailPanel({
  open,
  briefing,
  onClose,
  onActionSelect,
}: {
  open: boolean;
  briefing: FumeroBriefingPayload | null;
  onClose: () => void;
  onActionSelect: (prompt: string) => void;
}) {
  const [MotionAside, setMotionAside] = useState<ComponentType<MotionAsideProps> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void import("framer-motion").then((mod) => {
      if (!cancelled) setMotionAside(() => mod.motion.aside as ComponentType<MotionAsideProps>);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const panelClass =
    "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--fumero-border)] bg-[var(--fumero-surface)] shadow-xl fumero-panel-slide";

  const panelBody = (
    <>
      <div className="flex items-center justify-between border-b border-[var(--fumero-border)] px-5 py-4">
        <div>
          <h2
            id="max-briefing-title"
            className="text-sm font-semibold text-[var(--fumero-text)]"
          >
            Dagoverzicht van Max
          </h2>
          {briefing ? (
            <p className="mt-0.5 text-xs text-[var(--fumero-text-muted)]">
              {formatBriefingTime(briefing.generated_at)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
          onClick={onClose}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {briefing ? (
          <>
            <p className="mb-6 text-sm leading-relaxed text-[var(--fumero-text-muted)]">
              {briefing.summary}
            </p>
            <Section
              title="Actie nodig"
              dotClass="bg-[var(--fumero-destructive)]"
              items={briefing.actions}
              onSelect={onActionSelect}
            />
            <Section
              title="Kansen"
              dotClass="bg-[var(--fumero-accent)]"
              items={briefing.opportunities}
              onSelect={onActionSelect}
            />
            <Section
              title="Status"
              dotClass="bg-[var(--fumero-text-subtle)]"
              items={briefing.status}
              onSelect={onActionSelect}
            />
          </>
        ) : (
          <p className="text-sm text-[var(--fumero-text-muted)]">Briefing laden…</p>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/20"
        aria-label="Sluit briefing"
        onClick={onClose}
      />
      {MotionAside ? (
        <MotionAside
          className={panelClass}
          role="dialog"
          aria-labelledby="max-briefing-title"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {panelBody}
        </MotionAside>
      ) : (
        <aside className={panelClass} role="dialog" aria-labelledby="max-briefing-title">
          {panelBody}
        </aside>
      )}
    </>
  );
}
