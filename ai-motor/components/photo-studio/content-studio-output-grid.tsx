"use client";

import { useEffect, useState } from "react";
import { Calendar, Copy, Download, Loader2 } from "lucide-react";
import type { CompanyId } from "@/lib/types";
import type { ContentStudioGridItem, ContentStudioSkeletonMode } from "@/lib/photo-studio/types";
import { starterTemplatesForKlant } from "@/lib/photo-studio/starter-templates";
import {
  ContentStudioTileDrawer,
  starterToDrawerDraft,
  type ContentStudioDrawerDraft,
} from "@/components/photo-studio/content-studio-tile-drawer";

type Props = {
  klant: CompanyId;
  items: ContentStudioGridItem[];
  skeletonCount: number;
  skeletonMode?: ContentStudioSkeletonMode;
  onScheduled?: () => void;
  onGenerated?: (items: ContentStudioGridItem[]) => void;
  externalDraft?: ContentStudioDrawerDraft | null;
  onExternalDraftClose?: () => void;
};

export function ContentStudioOutputGrid({
  klant,
  items,
  skeletonCount,
  skeletonMode = "generate",
  onScheduled,
  onGenerated,
  externalDraft,
  onExternalDraftClose,
}: Props) {
  const [selected, setSelected] = useState<ContentStudioGridItem | null>(null);
  const [localDraft, setLocalDraft] = useState<ContentStudioDrawerDraft | null>(
    null
  );
  const starterTemplates = starterTemplatesForKlant(klant);
  const skeletonLabel =
    skeletonMode === "edit" ? "Bezig met bewerken…" : "Bezig met genereren…";

  const draft = externalDraft ?? localDraft;

  useEffect(() => {
    if (externalDraft) {
      setSelected(null);
      setLocalDraft(null);
    }
  }, [externalDraft]);

  const closeDrawer = () => {
    setSelected(null);
    setLocalDraft(null);
    onExternalDraftClose?.();
  };

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
          <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center gap-6">
            <p className="max-w-md text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
              Kies een voorbeeldtemplate of typ hieronder wat je wilt maken —
              je beelden verschijnen hier.
            </p>
            {starterTemplates.length > 0 ? (
              <div className="w-full max-w-3xl">
                <h2 className="mb-3 text-center fumero-text-body-sm font-medium text-[var(--fumero-text)]">
                  Voorbeelden
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {starterTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="content-studio-tile rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] p-3 text-left transition-colors hover:border-[rgba(105,196,0,0.35)] hover:bg-[var(--fumero-surface)]"
                      onClick={() =>
                        setLocalDraft(starterToDrawerDraft(template))
                      }
                    >
                      <span className="mb-1 block fumero-text-body-sm font-medium text-[var(--fumero-text)]">
                        {template.title}
                      </span>
                      <span className="fumero-text-caption text-[var(--fumero-text-muted)]">
                        {template.platform} · {template.aspect_ratio}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="fumero-skeleton relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl"
                aria-busy="true"
                aria-label={skeletonLabel}
              >
                <Loader2 className="h-6 w-6 animate-spin text-[var(--fumero-text-muted)]" />
                <span className="px-3 text-center fumero-text-caption text-[var(--fumero-text-muted)]">
                  {skeletonLabel}
                </span>
              </div>
            ))}
            {items.map((item) => (
              <article
                key={item.tracking_id}
                className="content-studio-tile group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[var(--fumero-surface-muted)]"
                onClick={() => {
                  setLocalDraft(null);
                  setSelected(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLocalDraft(null);
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
        draft={draft}
        onClose={closeDrawer}
        onScheduled={onScheduled}
        onGenerated={(newItems) => {
          onGenerated?.(newItems);
          closeDrawer();
        }}
      />
    </>
  );
}
