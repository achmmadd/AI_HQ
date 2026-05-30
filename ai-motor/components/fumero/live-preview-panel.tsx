"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FumeroSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { FumeroBuildTimeline } from "@/components/fumero/features/fumero-build-timeline";
import { cacheBustPreviewUrl } from "@/lib/fumero/builder-config";
import {
  fumeroConceptVersionLabel,
  type FumeroLivePreviewPayload,
} from "@/lib/fumero/content-preview";

export function FumeroLivePreviewPanel({
  preview,
  onClose,
  onRefresh,
  visualEditMode,
  onVisualEditPick,
}: {
  preview: FumeroLivePreviewPayload;
  onClose: () => void;
  onRefresh?: () => void;
  visualEditMode?: boolean;
  onVisualEditPick?: (hint: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const isGenerating =
    preview.status === "generating" || preview.building || !preview.previewUrl;
  const src = preview.previewUrl
    ? cacheBustPreviewUrl(preview.previewUrl, preview.previewEpoch)
    : null;

  const versionLabel =
    preview.version != null ? fumeroConceptVersionLabel(preview.version) : null;

  const subtitle = isGenerating
    ? preview.buildPhase
      ? `Max bouwt… ${preview.buildPhase}`
      : "Max bouwt…"
    : versionLabel ?? "Live preview";

  const attachVisualEditListener = useCallback(() => {
    if (!visualEditMode || !onVisualEditPick || !iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || target === doc.body || target === doc.documentElement) return;
        e.preventDefault();
        e.stopPropagation();
        const tag = target.tagName.toLowerCase();
        const text = (target.textContent ?? "").trim().slice(0, 80);
        const hint = text
          ? `Wijzig het <${tag}> element met tekst "${text}"`
          : `Wijzig het <${tag}> element in de preview`;
        onVisualEditPick(hint);
      };
      doc.addEventListener("click", handler, true);
      return () => doc.removeEventListener("click", handler, true);
    } catch {
      return undefined;
    }
  }, [visualEditMode, onVisualEditPick]);

  useEffect(() => {
    if (!src || !visualEditMode) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      const cleanup = attachVisualEditListener();
      return cleanup;
    };
    iframe.addEventListener("load", onLoad);
    const cleanup = attachVisualEditListener();
    return () => {
      iframe.removeEventListener("load", onLoad);
      cleanup?.();
    };
  }, [src, visualEditMode, attachVisualEditListener]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const panel = (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[90] flex flex-col bg-[#FAFAFA]"
          : "fumero-live-preview flex h-full min-h-0 flex-col bg-[#FAFAFA]"
      }
    >
      <div className="fumero-live-preview-header flex shrink-0 items-center justify-between gap-2 border-b border-[#E5E5E5]/80 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight text-[#171717]">
            {preview.title}
          </p>
          <p
            className="mt-0.5 text-[12px] leading-tight text-[#737373]"
            aria-live={isGenerating ? "polite" : undefined}
          >
            {isGenerating ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-[#69C400]" />
                {subtitle}
              </span>
            ) : (
              subtitle
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {visualEditMode ? (
            <span className="rounded-full bg-[rgba(105,196,0,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#3d7a00]">
              Klik element
            </span>
          ) : null}
          {onRefresh && src ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-[#525252] hover:bg-[#E5E5E5]"
              onClick={onRefresh}
              aria-label="Preview vernieuwen"
              title="Vernieuwen"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {src ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg text-[#525252] hover:bg-[#E5E5E5]"
                onClick={() => setFullscreen((v) => !v)}
                aria-label={fullscreen ? "Volledig scherm sluiten" : "Volledig scherm"}
                title={fullscreen ? "Verkleinen" : "Volledig scherm"}
              >
                {fullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-[#525252] hover:bg-[#E5E5E5] hover:text-[#171717]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-[#525252] hover:bg-[#E5E5E5]"
            onClick={() => {
              setFullscreen(false);
              onClose();
            }}
            aria-label="Preview sluiten"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <div className="shrink-0 border-b border-[#E5E5E5]/60 px-4 py-2">
          <FumeroBuildTimeline
            activePhase={preview.buildPhase}
            building={preview.building ?? true}
            compact
          />
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-white">
        {src ? (
          <iframe
            ref={iframeRef}
            key={preview.previewEpoch ?? preview.previewUrl ?? "live"}
            title={`Preview ${preview.title}`}
            src={src}
            className="h-full min-h-[320px] w-full border-0"
          />
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 p-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#69C400]" />
            <p className="text-[14px] text-[#525252]">{subtitle}</p>
            <div className="w-full max-w-sm space-y-2">
              <FumeroSkeleton className="h-2 w-2/3" />
              <FumeroSkeleton className="h-24 w-full rounded-lg" />
              <FumeroSkeleton className="h-3 w-1/2" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return panel;
}
