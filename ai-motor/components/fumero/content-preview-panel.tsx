"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FumeroSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { ContentChannelPreviewFrames } from "@/components/content-channel-preview";
import {
  contentPreviewTitle,
  normalizePreviewPlatform,
  type FumeroContentPreviewPayload,
} from "@/lib/fumero/content-preview";
import { cn } from "@/lib/utils";

export function FumeroContentPreviewPanel({
  preview,
  onClose,
  onContentChange,
}: {
  preview: FumeroContentPreviewPayload;
  onClose: () => void;
  onContentChange?: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(preview.content?.trim() ?? "");
  const title =
    preview.title ??
    contentPreviewTitle(preview.contentType, preview.platform);
  const isGenerating = preview.status === "generating";
  const isImage = preview.mediaKind === "image" && preview.mediaUrl;
  const canvasMode = Boolean(preview.canvasMode);
  const text = canvasMode ? draft : preview.content?.trim() ?? "";

  useEffect(() => {
    setDraft(preview.content?.trim() ?? "");
  }, [preview.content, preview.status]);
  const channel = normalizePreviewPlatform(preview.platform);

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--fumero-surface-muted)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--fumero-border)] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--fumero-text)]">{title}</p>
          <p className="text-[10px] text-[var(--fumero-text-muted)]">
            {isGenerating
              ? "Genereren…"
              : canvasMode
                ? "Schrijven · bewerk en keur goed via chat"
                : "Concept · bibliotheek"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {preview.postId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg px-2 text-xs text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)]"
              asChild
            >
              <Link href="/fumero/bibliotheek">Bibliotheek</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)]"
            onClick={onClose}
            aria-label="Preview sluiten"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {isGenerating ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[var(--fumero-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--fumero-accent)]" />
              Content genereren…
            </div>
            <FumeroSkeleton className="h-48 w-full rounded-xl" />
            <FumeroSkeleton className="h-4 w-2/3" />
            <FumeroSkeleton className="h-4 w-1/2" />
          </div>
        ) : isImage ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.mediaUrl}
              alt={title}
              className="max-h-[min(70vh,520px)] w-full rounded-xl border border-[var(--fumero-border)] object-contain bg-[var(--fumero-surface)]"
            />
            {text ? (
              <p className="text-[12px] leading-relaxed text-[var(--fumero-text-muted)]">{text}</p>
            ) : null}
            <a
              href={preview.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open afbeelding
            </a>
          </div>
        ) : text || canvasMode ? (
          <div className="space-y-4">
            {!canvasMode &&
              preview.contentType === "social_post" && (
              <ContentChannelPreviewFrames platform={channel} text={text} />
            )}
            {canvasMode ? (
              <textarea
                value={draft}
                onChange={(e) => {
                  const next = e.target.value;
                  setDraft(next);
                  onContentChange?.(next);
                }}
                readOnly={isGenerating}
                placeholder="Long-form tekst verschijnt hier…"
                className="min-h-[min(70vh,520px)] w-full resize-y rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4 font-mono text-[13px] leading-relaxed text-[var(--fumero-text)] outline-none focus:border-[var(--fumero-accent)]/50 focus:ring-1 focus:ring-[var(--fumero-accent)]/20"
                spellCheck
              />
            ) : (
              <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--fumero-text)]">
                  {text}
                </p>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className={cn(
                "h-8 gap-1 rounded-lg border-[var(--fumero-border)] bg-[var(--fumero-surface)] text-xs",
                copied && "text-[var(--fumero-accent)]"
              )}
              onClick={() => void copyText()}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Gekopieerd" : "Kopiëren"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--fumero-text-muted)]">Geen preview beschikbaar.</p>
        )}
      </div>
    </div>
  );
}
