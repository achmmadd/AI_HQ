"use client";
import { useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Redo2,
  Share2,
  Undo2,
  Upload,
} from "lucide-react";
import { ControlePopover } from "@/components/fumero/worldclass-studio/controle-popover";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";
type Props = {
  mode: "make" | "edit";
  onModeChange: (mode: "make" | "edit") => void;
  onPublish: () => void;
  selectedItem: ContentStudioGridItem | null;
};
export function StudioTopbar({
  mode,
  onModeChange,
  onPublish,
  selectedItem,
}: Props) {
  const [controleOpen, setControleOpen] = useState(false);
  const controleBtnRef = useRef<HTMLButtonElement>(null);
  return (
    <header className="wc-topbar wc-glass" data-testid="studio-topbar">
      {" "}
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--wc-text)] hover:bg-[var(--wc-surface-muted)]"
        aria-label="Project"
      >
        {" "}
        Studio project{" "}
        <ChevronDown className="h-3.5 w-3.5 text-[var(--wc-text-muted)]" />{" "}
      </button>{" "}
      <div className="hidden items-center gap-0.5 sm:flex">
        {" "}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)]"
          aria-label="Ongedaan maken"
          title="Ongedaan maken (binnenkort)"
          disabled
        >
          {" "}
          <Undo2 className="h-4 w-4" />{" "}
        </button>{" "}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)]"
          aria-label="Opnieuw"
          title="Opnieuw (binnenkort)"
          disabled
        >
          {" "}
          <Redo2 className="h-4 w-4" />{" "}
        </button>{" "}
      </div>{" "}
      <div
        className="ml-2 inline-flex rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface-muted)]/70 p-0.5"
        role="group"
        aria-label="Werkmodus"
      >
        {" "}
        {(["make", "edit"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-md px-3 py-1 text-[12px] font-medium ${mode === m ? "bg-[var(--wc-surface)] text-[var(--wc-text)] shadow-sm" : "text-[var(--wc-text-muted)]"}`}
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
          >
            {" "}
            {m === "make" ? "Maken" : "Bewerken"}{" "}
          </button>
        ))}{" "}
      </div>{" "}
      <div className="ml-auto flex items-center gap-1">
        {" "}
        <button
          type="button"
          className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)] sm:inline-flex"
          title="Opgeslagen"
        >
          {" "}
          <Bookmark className="h-3.5 w-3.5" /> Opgeslagen{" "}
        </button>{" "}
        <div className="relative">
          {" "}
          <button
            ref={controleBtnRef}
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--wc-text)] hover:bg-[var(--wc-surface-muted)]"
            aria-expanded={controleOpen}
            onClick={() => setControleOpen((o) => !o)}
          >
            {" "}
            Controle{" "}
          </button>{" "}
          <ControlePopover
            open={controleOpen}
            onClose={() => setControleOpen(false)}
            anchorRef={controleBtnRef}
          />{" "}
        </div>{" "}
        <button
          type="button"
          className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)] sm:inline-flex"
          title="Delen (binnenkort)"
          disabled={!selectedItem}
        >
          {" "}
          <Share2 className="h-3.5 w-3.5" /> Delen{" "}
        </button>{" "}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--wc-accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--fumero-accent-foreground)] hover:bg-[var(--wc-accent-hover)] disabled:opacity-50"
          onClick={onPublish}
          disabled={!selectedItem}
        >
          {" "}
          <Upload className="h-3.5 w-3.5" /> Publiceren{" "}
        </button>{" "}
      </div>{" "}
    </header>
  );
}
