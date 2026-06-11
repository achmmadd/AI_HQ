"use client";
import { useMemo, useState } from "react";

import {
  Calendar,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import type { usePhotoStudioGeneration } from "@/hooks/use-photo-studio-generation";

import type { ContentStudioGridItem } from "@/lib/photo-studio/types";

import type { CompanyId } from "@/lib/types";
type Gen = ReturnType<typeof usePhotoStudioGeneration>;
type Props = {
  klant: CompanyId;
  studio: Gen;
  onSelectForEdit?: (item: ContentStudioGridItem) => void;
};
function AssetThumb({
  item,
  selected,
  onClick,
  size = "sm",
}: {
  item: ContentStudioGridItem;
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "lg";
}) {
  const isVideo = item.media_type === "video";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border transition-all ${
        selected
          ? "border-[var(--wc-accent)] ring-2 ring-[var(--wc-accent-muted)]"
          : "border-[var(--wc-border)] hover:border-[var(--wc-border-strong)]"
      } ${size === "lg" ? "aspect-[4/3] w-full" : "aspect-square"}`}
      aria-pressed={selected}
    >
      {isVideo ? (
        <video
          src={item.master_url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.master_url}
          alt=""
          className="h-full w-full object-cover"
        />
      )}
    </button>
  );
}

export function ResultsWorkspace({ klant, studio, onSelectForEdit }: Props) {
  const { items, skeletonCount, skeletonMode, refreshLibrary } = studio;
  const [selected, setSelected] = useState<ContentStudioGridItem | null>(null);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">(
    "all",
  );
  const filtered = useMemo(
    () =>
      mediaFilter === "all"
        ? items
        : items.filter((i) => i.media_type === mediaFilter),
    [items, mediaFilter],
  );
  const activeSelected = useMemo(() => {
    if (selected && filtered.some((i) => i.id === selected.id)) return selected;
    return filtered[0] ?? null;
  }, [selected, filtered]);
  const variants = activeSelected
    ? [
        activeSelected,
        ...activeSelected.variants.map((v, idx) => ({
          ...activeSelected,
          id: activeSelected.id * 1000 + idx,
          master_url: v.public_url,
        })),
      ].slice(0, 4)
    : [];
  const schedule = async (item: ContentStudioGridItem) => {
    if (!item.content_id) return;
    const when = window.prompt(
      "Inplannen op (YYYY-MM-DD HH:MM, leeg = morgen 10:00):",
      "",
    );
    const res = await fetch("/api/photo-studio/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        klant,
        content_id: item.content_id,
        datetime: when?.trim() || undefined,
        platform: "instagram",
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      scheduled_at?: string;
    };
    if (!res.ok) {
      alert(data.error || "Inplannen mislukt");
      return;
    }
    alert(`Ingepland: ${data.scheduled_at ?? "ok"}`);
    refreshLibrary();
  };
  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };
  const isEmpty = !filtered.length && skeletonCount === 0;
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="results-workspace"
    >
      {" "}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--wc-border)] px-4 py-2">
        {" "}
        <span className="text-[13px] font-medium text-[var(--wc-text)]">
          Resultaten
        </span>{" "}
        <div className="flex items-center gap-1">
          {" "}
          {(
            [
              ["all", "Alle"],
              ["image", "Beelden"],
              ["video", "Video's"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setMediaFilter(val)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${mediaFilter === val ? "bg-[var(--wc-accent-muted)] text-[var(--wc-text)]" : "text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)]"}`}
              aria-pressed={mediaFilter === val}
            >
              {" "}
              {label}{" "}
            </button>
          ))}{" "}
          <button
            type="button"
            onClick={refreshLibrary}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)]"
            aria-label="Vernieuwen"
          >
            {" "}
            <RefreshCw className="h-3.5 w-3.5" />{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {" "}
        {skeletonCount > 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--wc-text-muted)]">
            {" "}
            <Loader2 className="h-8 w-8 animate-spin text-[var(--wc-accent)]" />{" "}
            <p className="text-[13px]">
              {" "}
              {skeletonMode === "edit"
                ? "Bezig met bewerken…"
                : "Bezig met genereren…"}{" "}
            </p>{" "}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-[var(--wc-text-muted)]">
            {" "}
            <Sparkles className="h-10 w-10 opacity-40" />{" "}
            <p className="text-[14px] font-medium">Nog geen resultaten</p>{" "}
            <p className="max-w-xs text-[13px]">
              {" "}
              Beschrijf wat je wilt maken en druk op Maken om te starten.{" "}
            </p>{" "}
          </div>
        ) : activeSelected ? (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            {" "}
            <div className="flex min-h-0 flex-col gap-3">
              {" "}
              <AssetThumb
                item={activeSelected}
                selected
                onClick={() => setSelected(activeSelected)}
                size="lg"
              />{" "}
              {activeSelected.user_prompt ? (
                <p className="line-clamp-2 text-[12px] text-[var(--wc-text-muted)]">
                  {" "}
                  {activeSelected.user_prompt}{" "}
                </p>
              ) : null}{" "}
              <div className="flex flex-wrap gap-2">
                {" "}
                <a
                  href={activeSelected.master_url}
                  download
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--wc-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--wc-text)] hover:bg-[var(--wc-surface-muted)]"
                >
                  {" "}
                  <Download className="h-3.5 w-3.5" /> Download{" "}
                </a>{" "}
                <button
                  type="button"
                  onClick={() => void copyPrompt(activeSelected.user_prompt)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--wc-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--wc-text)] hover:bg-[var(--wc-surface-muted)]"
                >
                  {" "}
                  <Copy className="h-3.5 w-3.5" /> Prompt{" "}
                </button>{" "}
                {activeSelected.content_id ? (
                  <button
                    type="button"
                    onClick={() => void schedule(activeSelected)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--wc-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--wc-text)] hover:bg-[var(--wc-surface-muted)]"
                  >
                    {" "}
                    <Calendar className="h-3.5 w-3.5" /> Inplannen{" "}
                  </button>
                ) : null}{" "}
              </div>{" "}
            </div>{" "}
            {variants.length > 1 ? (
              <div className="grid grid-cols-2 gap-2 content-start">
                {" "}
                {variants.slice(1).map((v) => (
                  <AssetThumb
                    key={v.id}
                    item={v}
                    selected={false}
                    onClick={() => setSelected(v)}
                  />
                ))}{" "}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 content-start">
                {" "}
                {filtered
                  .filter((i) => i.id !== activeSelected.id)
                  .slice(0, 3)
                  .map((item) => (
                    <AssetThumb
                      key={item.id}
                      item={item}
                      selected={false}
                      onClick={() => setSelected(item)}
                    />
                  ))}{" "}
              </div>
            )}{" "}
          </div>
        ) : null}{" "}
      </div>{" "}
      {activeSelected ? (
        <div className="shrink-0 border-t border-[var(--wc-border)] bg-[var(--wc-surface-muted)] px-4 py-3">
          {" "}
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--wc-text-muted)]">
            {" "}
            Maak hiervan{" "}
          </p>{" "}
          <div className="flex flex-wrap gap-2">
            {" "}
            <button
              type="button"
              className="rounded-lg border border-[var(--wc-border)] bg-[var(--fumero-surface)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--wc-surface-muted)]"
              onClick={() => onSelectForEdit?.(activeSelected)}
            >
              {" "}
              Variatie maken{" "}
            </button>{" "}
            <button
              type="button"
              className="rounded-lg border border-[var(--wc-border)] bg-[var(--fumero-surface)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--wc-surface-muted)]"
              onClick={() => void copyPrompt(activeSelected.user_prompt)}
            >
              {" "}
              Prompt hergebruiken{" "}
            </button>{" "}
            {activeSelected.content_id ? (
              <button
                type="button"
                className="rounded-lg border border-[var(--wc-border)] bg-[var(--fumero-surface)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--wc-surface-muted)]"
                onClick={() => void schedule(activeSelected)}
              >
                {" "}
                Publicatie inplannen{" "}
              </button>
            ) : (
              <span className="self-center text-[11px] text-[var(--wc-text-subtle)]">
                {" "}
                Opslaan in bibliotheek vereist voor inplannen{" "}
              </span>
            )}{" "}
          </div>{" "}
        </div>
      ) : null}{" "}
    </div>
  );
}
