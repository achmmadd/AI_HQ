"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FumeroSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { MotorsChatMarkdown } from "@/components/motors-chat-markdown";
import {
  contentPreviewTitle,
  type FumeroContentPreviewPayload,
} from "@/lib/fumero/content-preview";
import { cn } from "@/lib/utils";

type ViewMode = "edit" | "preview";

export function FumeroCanvasPanel({
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
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const title =
    preview.title ??
    contentPreviewTitle(preview.contentType, preview.platform);
  const isGenerating = preview.status === "generating";

  useEffect(() => {
    setDraft(preview.content?.trim() ?? "");
  }, [preview.content, preview.status]);

  const copyText = async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="fumero-canvas-panel flex h-full min-h-0 flex-col bg-[#FAFAFA]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E5E5E5] bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#171717]">{title}</p>
          <p className="text-[10px] text-[#737373]">
            {isGenerating ? "Genereren…" : "Schrijven · bewerk of bekijk als document"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-0.5 text-[10px] font-medium">
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                viewMode === "preview"
                  ? "bg-white text-[#171717] shadow-sm"
                  : "text-[#737373] hover:text-[#171717]"
              )}
              onClick={() => setViewMode("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                viewMode === "edit"
                  ? "bg-white text-[#171717] shadow-sm"
                  : "text-[#737373] hover:text-[#171717]"
              )}
              onClick={() => setViewMode("edit")}
            >
              Bewerken
            </button>
          </div>
          {preview.postId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 rounded-lg px-2 text-xs text-[#525252] hover:bg-[#E5E5E5]"
              asChild
            >
              <Link href="/fumero/bibliotheek">
                <BookMarked className="h-3.5 w-3.5" />
                Bibliotheek
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 rounded-lg px-2 text-xs text-[#525252] hover:bg-[#E5E5E5]"
              disabled={!draft.trim() || isGenerating}
              title="Keur goed in chat om op te slaan"
            >
              <BookMarked className="h-3.5 w-3.5" />
              Opslaan
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-[#525252] hover:bg-[#E5E5E5]"
            onClick={onClose}
            aria-label="Schrijven sluiten"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {isGenerating ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[#525252]">
              <Loader2 className="h-4 w-4 animate-spin text-[#69C400]" />
              Document genereren…
            </div>
            <FumeroSkeleton className="h-48 w-full rounded-xl" />
            <FumeroSkeleton className="h-4 w-2/3" />
            <FumeroSkeleton className="h-4 w-1/2" />
          </div>
        ) : viewMode === "edit" ? (
          <textarea
            value={draft}
            onChange={(e) => {
              const next = e.target.value;
              setDraft(next);
              onContentChange?.(next);
            }}
            placeholder="Long-form tekst verschijnt hier…"
            className="min-h-[min(70vh,560px)] w-full resize-y rounded-xl border border-[#E5E5E5] bg-white p-4 font-mono text-[13px] leading-relaxed text-[#171717] outline-none focus:border-[#69C400]/50 focus:ring-1 focus:ring-[#69C400]/20"
            spellCheck
          />
        ) : (
          <article className="fumero-canvas-doc min-h-[min(70vh,560px)] rounded-xl border border-[#E5E5E5] bg-white px-5 py-4">
            {draft.trim() ? (
              <MotorsChatMarkdown content={draft} variant="assistant" />
            ) : (
              <p className="text-sm text-[#737373]">
                Nog geen inhoud — start in chat of kies Schrijven in het + menu.
              </p>
            )}
          </article>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E5E5E5] bg-white px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn(
            "h-8 gap-1 rounded-lg border-[#E5E5E5] bg-[#FAFAFA] text-xs",
            copied && "text-[#69C400]"
          )}
          disabled={!draft.trim()}
          onClick={() => void copyText()}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Gekopieerd" : "Kopiëren"}
        </Button>
      </div>
    </div>
  );
}
