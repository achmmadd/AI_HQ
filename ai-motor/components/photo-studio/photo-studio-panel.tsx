"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ContentStudioOutputGrid } from "@/components/photo-studio/content-studio-output-grid";
import { ContentStudioPromptBar } from "@/components/photo-studio/content-studio-prompt-bar";
import { PhotoStudioCarousel } from "@/components/photo-studio/photo-studio-carousel";
import { PhotoStudioMenuBatch } from "@/components/photo-studio/photo-studio-menu-batch";
import { PhotoStudioPostProcess } from "@/components/photo-studio/photo-studio-post-process";
import type { CompanyId } from "@/lib/types";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";

type MeerView = "carousel" | "menu" | "postprocess" | null;

type Props = {
  klant: CompanyId;
  title?: string;
};

export function PhotoStudioPanel({
  klant,
  title = "Content Studio",
}: Props) {
  const [items, setItems] = useState<ContentStudioGridItem[]>([]);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meerOpen, setMeerOpen] = useState(false);
  const [meerView, setMeerView] = useState<MeerView>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadLibrary = useCallback(async () => {
    const res = await fetch(`/api/photo-studio/library?klant=${klant}`, {
      credentials: "include",
    });
    const data = (await res.json()) as {
      items?: Array<
        ContentStudioGridItem & { prompt?: string }
      >;
    };
    if (res.ok && Array.isArray(data.items)) {
      setItems(
        data.items.map((i) => ({
          id: i.id,
          tracking_id: i.tracking_id,
          user_prompt: i.user_prompt ?? i.prompt ?? "",
          master_url: i.master_url,
          content_id: i.content_id,
          created_at: i.created_at,
          variants: i.variants ?? [],
        }))
      );
    }
  }, [klant]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary, refreshKey]);

  const onGenerated = (newItems: ContentStudioGridItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    setRefreshKey((n) => n + 1);
  };

  const openMeer = (view: MeerView) => {
    setMeerView(view);
    setMeerOpen(false);
  };

  if (meerView) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--fumero-border)] px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="fumero-text-body-sm text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
              onClick={() => setMeerView(null)}
            >
              ← Terug
            </button>
            <h1 className="fumero-text-h3 text-[var(--fumero-text)]">
              {meerView === "carousel"
                ? "Instagram carrousel"
                : meerView === "menu"
                  ? "Menu-batch"
                  : "Nabewerking"}
            </h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {meerView === "carousel" ? (
            <PhotoStudioCarousel
              klant={klant}
              onDone={() => {
                setRefreshKey((n) => n + 1);
              }}
            />
          ) : null}
          {meerView === "menu" ? (
            <PhotoStudioMenuBatch
              klant={klant}
              onDone={() => setRefreshKey((n) => n + 1)}
            />
          ) : null}
          {meerView === "postprocess" ? (
            <PhotoStudioPostProcess klant={klant} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 py-3 md:px-6">
        <h1 className="fumero-text-h2 text-[var(--fumero-text)]">{title}</h1>
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={() => setMeerOpen((o) => !o)}
            aria-expanded={meerOpen}
          >
            Meer
            <ChevronDown className="h-4 w-4 text-[var(--fumero-text-muted)]" />
          </button>
          {meerOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Menu sluiten"
                onClick={() => setMeerOpen(false)}
              />
              <div className="fumero-popover-elevated absolute right-0 z-50 mt-1 min-w-[200px] rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface-elevated,var(--fumero-surface))] py-1 shadow-[var(--fumero-shadow-md)]">
                {(
                  [
                    ["carousel", "Instagram carrousel"],
                    ["menu", "Menu-batch"],
                    ["postprocess", "Nabewerking (Sharp)"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="block w-full px-3 py-2 text-left fumero-text-body-sm text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                    onClick={() => openMeer(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 fumero-text-body-sm text-red-800 md:mx-6 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <ContentStudioOutputGrid
        klant={klant}
        items={items}
        skeletonCount={skeletonCount}
        onScheduled={() => setRefreshKey((n) => n + 1)}
      />

      <ContentStudioPromptBar
        klant={klant}
        busy={busy}
        onBusyChange={setBusy}
        onGenerated={onGenerated}
        onSkeletonCount={setSkeletonCount}
        onError={setError}
      />
    </div>
  );
}
