"use client";

import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { FumeroEmbedFrame } from "@/components/fumero/fumero-embed-frame";
import { FumeroStatusBadge } from "@/components/fumero/ops/fumero-status-badge";

type PreviewStatus = "concept" | "published" | "archived";
type PreviewType = "widget" | "internal" | "customer";

class EmbedErrorBoundary extends Component<
  { children: ReactNode; naam: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("[FumeroAppPreview] embed render failed:", error.message, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 bg-[#FAFAFA] p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-[#171717]">Preview kon niet laden</p>
            <p className="mt-1 max-w-sm text-xs text-[#737373]">
              De app-code bevat een fout of kon niet worden weergegeven. Bewerk de app in chat om
              het op te lossen.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function publicUrl(slug: string, type: PreviewType, status: PreviewStatus): string | null {
  if (status !== "published") return null;
  if (type === "customer") return `/embed/fumero/app/${slug}`;
  if (type === "internal") return `/apps/${slug}`;
  return null;
}

/** Internal app preview — Fumero Studio chrome, no builder links. */
export function FumeroAppPreview({
  naam,
  slug,
  code,
  status = "published",
  type = "internal",
}: {
  naam: string;
  slug: string;
  code: string;
  status?: PreviewStatus;
  type?: PreviewType;
}) {
  const openTabHref = useMemo(() => {
    if (status === "published" && type === "customer") {
      return `/embed/fumero/app/${slug}`;
    }
    return `/apps/${slug}${status === "concept" ? "?preview=1" : ""}`;
  }, [slug, status, type]);

  const publishedUrl = useMemo(
    () => publicUrl(slug, type, status),
    [slug, type, status]
  );

  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

  return (
    <div className="flex min-h-dvh flex-col bg-[#171717]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#404040] px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#69C400]">
            Fumero Studio
          </span>
          <span className="text-[#525252]">·</span>
          <h1 className="truncate text-sm font-medium text-white">{naam}</h1>
          <FumeroStatusBadge
            status={status}
            className="shrink-0 border-[#404040] bg-[#262626] text-[11px] capitalize"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {publishedUrl ? (
            <span className="hidden text-[11px] text-[#737373] sm:inline">
              {base}
              {publishedUrl}
            </span>
          ) : status === "concept" ? (
            <span className="text-[11px] text-[#737373]">Concept — nog niet publiek</span>
          ) : null}
          <a
            href={openTabHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#a3a3a3] hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
            Open fullscreen
          </a>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {!code?.trim() ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 bg-[#FAFAFA] p-8 text-center">
            <p className="text-sm font-medium text-[#171717]">Geen app-code beschikbaar</p>
            <p className="text-xs text-[#737373]">Genereer of verfijn de app via chat.</p>
          </div>
        ) : (
          <EmbedErrorBoundary naam={naam}>
            <FumeroEmbedFrame naam={naam} code={code} />
          </EmbedErrorBoundary>
        )}
      </div>
    </div>
  );
}
