"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Gamepad2,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  ScanEye,
  X,
} from "lucide-react";
import {
  BuilderDeviceToggle,
  builderDeviceMaxWidth,
  type BuilderDeviceFrame,
} from "@/components/fumero/builder/builder-device-toggle";
import { Button } from "@/components/ui/button";
import { BuilderLoadingState } from "@/components/fumero/builder/builder-loading-state";
import { BuilderPreviewEmpty } from "@/components/fumero/builder/builder-preview-empty";
import { FumeroBuildTimeline } from "@/components/fumero/features/fumero-build-timeline";
import { cn } from "@/lib/utils";
import { cacheBustPreviewUrl } from "@/lib/fumero/builder-config";
import {
  fumeroConceptVersionLabel,
  type FumeroLivePreviewPayload,
} from "@/lib/fumero/content-preview";
import {
  isInteractivePreview,
  isStaticPreviewPlaceholder,
  PLAYABLE_PREVIEW_SANDBOX,
} from "@/lib/fumero/preview-interactive";
import {
  runtimeBadgeLabel,
  type ProjectRuntime,
} from "@/lib/fumero/project-runtime";

function RuntimeBadgePill({ runtime }: { runtime?: ProjectRuntime }) {
  if (!runtime) return null;
  const label = runtimeBadgeLabel(runtime);
  return (
    <span className="rounded-full border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--fumero-text-muted)]">
      {label}
    </span>
  );
}

function previewModeLabel(preview: FumeroLivePreviewPayload, interactive: boolean): string {
  if (preview.status === "generating" || preview.building) {
    return "Statische placeholder — Max bouwt je app…";
  }
  if (!interactive) {
    return "Statische preview — wacht tot de build klaar is";
  }
  if (preview.runtime === "full_app") {
    return "Interactieve app — klik en test; data via de app-API";
  }
  if (preview.runtime === "react") {
    return "Interactieve website-preview — voor volledige stack: Code workspace";
  }
  return "Interactieve app — klik in de preview om te spelen of te testen";
}

export function FumeroLivePreviewPanel({
  preview,
  onClose,
  onRefresh,
  visualEditMode,
  onVisualEditPick,
  onUxReview,
  uxReviewDisabled,
}: {
  preview: FumeroLivePreviewPayload;
  onClose: () => void;
  onRefresh?: () => void;
  visualEditMode?: boolean;
  onVisualEditPick?: (hint: string) => void;
  onUxReview?: () => void;
  uxReviewDisabled?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [uxBusy, setUxBusy] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<BuilderDeviceFrame>("desktop");

  const isGenerating =
    preview.status === "generating" || preview.building === true;
  const src = preview.previewUrl
    ? cacheBustPreviewUrl(preview.previewUrl, preview.previewEpoch)
    : null;

  const interactive =
    preview.interactive ??
    isInteractivePreview({
      previewUrl: preview.previewUrl,
      status: preview.status,
      building: preview.building,
    });

  const versionLabel =
    preview.version != null ? fumeroConceptVersionLabel(preview.version) : null;

  const subtitle = isGenerating
    ? `Max bouwt je ${preview.title}…`
    : interactive
      ? "Klaar om te spelen"
      : versionLabel ?? "Live preview";

  const showUxReview =
    Boolean(onUxReview) &&
    interactive &&
    (preview.uxReviewAvailable ||
      preview.runtime === "html" ||
      preview.runtime === "full_app" ||
      preview.runtime === "react");

  const attachVisualEditListener = useCallback(() => {
    if (!visualEditMode || !onVisualEditPick || !iframeRef.current || !interactive) {
      return;
    }
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || target === doc.body || target === doc.documentElement) return;
        const tag = target.tagName.toLowerCase();
        if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea" || tag === "a") {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
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
  }, [visualEditMode, onVisualEditPick, interactive]);

  useEffect(() => {
    if (!src || !visualEditMode || !interactive) return;
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
  }, [src, visualEditMode, interactive, attachVisualEditListener]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const handleUxReview = async () => {
    if (!onUxReview || uxReviewDisabled || uxBusy) return;
    setUxBusy(true);
    try {
      await onUxReview();
    } finally {
      setUxBusy(false);
    }
  };

  const focusPreviewForPlay = () => {
    iframeRef.current?.focus();
    try {
      iframeRef.current?.contentWindow?.focus();
    } catch {
      /* cross-origin guard */
    }
  };

  const panel = (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[90] flex flex-col bg-[var(--fumero-surface-muted)]"
          : "fumero-live-preview flex h-full min-h-0 flex-col bg-[var(--fumero-surface-muted)]"
      }
    >
      <div className="fumero-live-preview-header flex shrink-0 items-center justify-between gap-2 border-b border-[var(--fumero-border)]/80 px-4 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-semibold leading-tight text-[var(--fumero-text)]">
              {preview.title}
            </p>
            <RuntimeBadgePill runtime={preview.runtime} />
            {interactive ? (
              <span className="rounded-full bg-[var(--fumero-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fumero-success-fg)]">
                Speelbaar
              </span>
            ) : isGenerating || isStaticPreviewPlaceholder(src) ? (
              <span className="rounded-full bg-[var(--fumero-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--fumero-text-muted)]">
                Statisch
              </span>
            ) : null}
          </div>
          <p
            className="mt-0.5 text-[12px] leading-tight text-[var(--fumero-text-muted)]"
            aria-live={isGenerating ? "polite" : undefined}
          >
            {isGenerating ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-[var(--fumero-text-muted)]" />
                {subtitle}
              </span>
            ) : (
              subtitle
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <BuilderDeviceToggle
            value={deviceFrame}
            onChange={setDeviceFrame}
            className="mr-1 hidden sm:flex"
          />
          {visualEditMode && interactive ? (
            <span className="rounded-full bg-[var(--fumero-success-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--fumero-success-fg)]">
              Klik element
            </span>
          ) : null}
          {showUxReview ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={uxReviewDisabled || uxBusy || isGenerating}
              className="h-8 rounded-lg border-[var(--fumero-border)] px-2.5 text-[11px]"
              onClick={() => void handleUxReview()}
            >
              <ScanEye className="mr-1 h-3.5 w-3.5" />
              UX-check
            </Button>
          ) : null}
          {onRefresh && src ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)]"
              onClick={onRefresh}
              aria-label="Preview vernieuwen"
              title="Vernieuwen"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {src && interactive ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-lg border-[var(--fumero-border)] px-2.5 text-[11px]"
                onClick={() => {
                  focusPreviewForPlay();
                  window.open(src, "_blank", "noopener,noreferrer");
                }}
              >
                <Gamepad2 className="mr-1 h-3.5 w-3.5" />
                Speel / Open app
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)]"
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
            </>
          ) : src ? (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)] hover:text-[var(--fumero-text)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)]"
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
        <div className="shrink-0 border-b border-[var(--fumero-border)]/60 px-4 py-2">
          <FumeroBuildTimeline
            activePhase={preview.buildPhase}
            building={preview.building ?? true}
            compact
          />
        </div>
      ) : null}

      {src ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--fumero-border)]/60 px-4 py-2">
          <span className="text-[12px] text-[var(--fumero-text-muted)]">
            {previewModeLabel(preview, interactive)}
          </span>
          {interactive ? (
            <button
              type="button"
              className="text-[12px] font-medium text-[var(--fumero-text-muted)] underline-offset-2 hover:text-[var(--fumero-text)] hover:underline"
              onClick={focusPreviewForPlay}
            >
              Klik hier eerst voor toetsenbord
            </button>
          ) : null}
          {preview.embedCode ? (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--fumero-text)] hover:border-[var(--fumero-border-strong,var(--fumero-border))] hover:bg-[var(--fumero-surface-muted)]"
              onClick={() => {
                void navigator.clipboard.writeText(preview.embedCode ?? "");
              }}
            >
              Embed op site
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="builder-canvas-frame relative min-h-0 flex-1 bg-[var(--fumero-surface-muted)]">
        {isGenerating && !src ? (
          <BuilderLoadingState activeMessage={subtitle} />
        ) : src ? (
          <div
            className={cn(
              "flex h-full min-h-[320px] w-full items-start justify-center overflow-auto p-4",
              deviceFrame !== "desktop" && "bg-[var(--fumero-bg)]",
            )}
          >
            <div
              className={cn(
                "h-full min-h-[320px] w-full",
                deviceFrame !== "desktop" &&
                  "builder-device-phone mx-auto h-auto max-h-full w-full rounded-[28px] border border-[var(--fumero-border)] shadow-[var(--fumero-shadow-lg)]",
              )}
              style={
                deviceFrame !== "desktop"
                  ? { maxWidth: builderDeviceMaxWidth(deviceFrame) }
                  : undefined
              }
            >
              {deviceFrame === "mobile" ? (
                <div className="h-6 border-b border-[var(--fumero-border)] bg-[var(--fumero-surface)]" aria-hidden />
              ) : null}
              <iframe
                ref={iframeRef}
                key={`${preview.previewEpoch ?? preview.previewUrl ?? "live"}-${deviceFrame}`}
                title={`Preview ${preview.title}`}
                src={src}
                sandbox={PLAYABLE_PREVIEW_SANDBOX}
                className={cn(
                  "pointer-events-auto w-full border-0",
                  deviceFrame === "mobile"
                    ? "min-h-[640px] h-[calc(100%-24px)]"
                    : deviceFrame === "tablet"
                      ? "min-h-[520px] h-full"
                      : "h-full min-h-[320px]",
                )}
                onLoad={interactive ? focusPreviewForPlay : undefined}
              />
            </div>
          </div>
        ) : (
          <BuilderPreviewEmpty
            deviceFrame={deviceFrame}
            onDeviceChange={setDeviceFrame}
          />
        )}
      </div>
    </div>
  );

  return panel;
}
