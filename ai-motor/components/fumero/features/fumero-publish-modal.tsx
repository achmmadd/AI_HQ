"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FumeroPublishModalPayload = {
  name: string;
  liveUrl: string | null;
  embedCode: string | null;
  slug?: string;
  toolId?: number;
  version?: number;
};

export function FumeroPublishModal({
  open,
  payload,
  onClose,
}: {
  open: boolean;
  payload: FumeroPublishModalPayload | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"url" | "embed" | null>(null);

  if (!open || !payload) return null;

  const codeExportHref = payload.slug
    ? `/fumero/code?import=fumero-tool&slug=${encodeURIComponent(payload.slug)}`
    : payload.toolId
      ? `/fumero/code?import=fumero-tool&tool=${payload.toolId}`
      : "/fumero/code";

  const handleCopy = async (text: string, kind: "url" | "embed") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fumero-publish-title"
      onClick={onClose}
    >
      <div
        className="fumero-publish-modal w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(105,196,0,0.25)] bg-[rgba(105,196,0,0.08)] px-4 py-3">
          <div className="flex gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#69C400] text-white">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <div>
              <h2
                id="fumero-publish-title"
                className="text-[15px] font-semibold text-[#171717]"
              >
                Live — {payload.name}
              </h2>
              <p className="mt-0.5 text-[12px] text-[#525252]">
                {payload.version != null ? `v${payload.version} gepubliceerd` : "Gepubliceerd naar garage"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ios-tap-highlight rounded-lg p-1 text-[#737373] hover:bg-white/80 hover:text-[#171717]"
            aria-label="Sluiten"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {payload.liveUrl ? (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
                Live URL
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={payload.liveUrl}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-2.5 font-mono text-[11px] text-[#171717]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 shrink-0 rounded-lg border-[#E5E5E5]"
                  onClick={() => void handleCopy(payload.liveUrl!, "url")}
                >
                  {copied === "url" ? (
                    <Check className="h-3.5 w-3.5 text-[#69C400]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {payload.embedCode ? (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
                Embed
              </p>
              <div className="relative rounded-lg border border-[#E5E5E5] bg-[#171717]">
                <pre className="max-h-24 overflow-x-auto p-2.5 pr-12 font-mono text-[10px] leading-relaxed text-[#e5e5e5]">
                  <code>{payload.embedCode}</code>
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1.5 h-7 rounded-md border border-[#404040] bg-[#262626] px-2 text-[10px] text-white"
                  onClick={() => void handleCopy(payload.embedCode!, "embed")}
                >
                  {copied === "embed" ? "✓" : "Kopieer"}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-[11px] leading-relaxed text-[#737373]">
            PWA: gebruikers kunnen de app via de browser installeren (Add to Home Screen).
            Volledige App Store-build volgt later via Capacitor.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/fumero/projecten"
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#69C400] px-3 text-[12px] font-medium text-white hover:bg-[#5db000]"
              )}
              onClick={onClose}
            >
              Open in Projecten
            </Link>
            {payload.liveUrl ? (
              <a
                href={payload.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E5E5] px-3 text-[12px] font-medium text-[#171717] hover:bg-[#FAFAFA]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open live
              </a>
            ) : null}
            <details className="relative w-full">
              <summary className="cursor-pointer text-[12px] font-medium text-[#3d7a00] underline-offset-2 hover:underline">
                Meer opties
              </summary>
              <div className="mt-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-2">
                <Link
                  href={codeExportHref}
                  className="block rounded-md px-2 py-1.5 text-[12px] text-[#171717] hover:bg-white"
                  onClick={onClose}
                >
                  Export naar Code workspace
                </Link>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
