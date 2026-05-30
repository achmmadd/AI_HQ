"use client";

import { Calendar, Copy, Download } from "lucide-react";
import type { CompanyId } from "@/lib/types";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";

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
    <div className="content-studio-grid flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
      {isEmpty ? (
        <div className="flex h-full min-h-[40vh] items-center justify-center">
          <p className="max-w-md text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Typ hieronder wat je wilt maken — je beelden verschijnen hier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
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
              className="content-studio-tile group relative aspect-square overflow-hidden rounded-xl bg-[var(--fumero-surface-muted)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.master_url}
                alt={item.user_prompt.slice(0, 80)}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <p
                  className="mb-2 line-clamp-2 fumero-text-caption text-white/90"
                  title={item.user_prompt}
                >
                  {item.user_prompt.slice(0, 80)}
                </p>
                <div className="flex flex-wrap gap-1">
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
  );
}
