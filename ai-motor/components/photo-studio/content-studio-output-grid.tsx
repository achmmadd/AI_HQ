"use client";

import { useState } from "react";
import { Calendar, Copy, Download } from "lucide-react";
import type { CompanyId } from "@/lib/types";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";
import { ContentStudioTileDrawer } from "@/components/photo-studio/content-studio-tile-drawer";

type Props = {
  klant: CompanyId;
  items: ContentStudioGridItem[];
  skeletonCount: number;
  onScheduled?: () => void;
};

export function ContentStudioOutputGrid({
  klant,
  items,
  skeletonCount,
  onScheduled,
}: Props) {
  const [selected, setSelected] = useState<ContentStudioGridItem | null>(null);

  const schedule = async (item: ContentStudioGridItem) => {
    if (!item.content_id) return;
    const when = window.prompt(
      "Inplannen op (YYYY-MM-DD HH:MM, leeg = morgen 10:00):",
      ""
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
    const data = (await res.json()) as { error?: string; scheduled_at?: string };
    if (!res.ok) {
      alert(data.error || "Inplannen mislukt");
      return;
    }
    alert(`Ingepland: ${data.scheduled_at ?? "ok"}`);
    onScheduled?.();
  };

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const isEmpty = !items.length && skeletonCount === 0;

  return (
    <>
      <div className="content-studio-grid flex min-h-[60vh] flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        {isEmpty ? (
          <div className="flex h-full min-h-[50vh] items-center justify-center">
            <p className="max-w-md text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
              Typ hieronder wat je wilt maken — je beelden verschijnen hier.
            </p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="fumero-skeleton aspect-square rounded-xl"
                aria-hidden
              />
            ))}
            {items.map((item) => (
              <article
                key={item.tracking_id}
                className="content-studio-tile group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[var(--fumero-surface-muted)]"
                onClick={() => setSelected(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(item);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open details: ${item.user_prompt.slice(0, 40)}`}
              >
                {item.media_type === "video" ? (
                  <video
                    src={item.master_url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    loop
                    preload="metadata"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.master_url}
                    alt={item.user_prompt.slice(0, 80)}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <p
                    className="mb-2 line-clamp-2 fumero-text-caption text-white/90"
                    title={item.user_prompt}
                  >
                    {item.media_type === "video" ? "Video · " : ""}
                    {item.user_prompt.slice(0, 80)}
                  </p>
                  <div
                    className="flex flex-wrap gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={item.master_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-white/15 px-2 fumero-text-caption text-white backdrop-blur-sm hover:bg-white/25"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                    {item.content_id ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-white/15 px-2 fumero-text-caption text-white backdrop-blur-sm hover:bg-white/25"
                        onClick={() => void schedule(item)}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Inplannen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-white/15 px-2 fumero-text-caption text-white backdrop-blur-sm hover:bg-white/25"
                      onClick={() => void copyPrompt(item.user_prompt)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Prompt
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <ContentStudioTileDrawer
        klant={klant}
        item={selected}
        onClose={() => setSelected(null)}
        onScheduled={onScheduled}
      />
    </>
  );
}
