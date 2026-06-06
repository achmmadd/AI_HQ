"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/design-system/components";
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

  if (!payload) return null;

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
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ModalContent
        className="max-w-md border-[#E5E5E5] bg-white p-0"
        onPointerDownOutside={onClose}
      >
        <div className="border-b border-[rgba(105,196,0,0.25)] bg-[rgba(105,196,0,0.08)] px-4 py-3">
          <ModalHeader className="pr-8">
            <div className="flex gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#69C400] text-white">
                <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
              </span>
              <div>
                <ModalTitle className="text-base text-[#171717]">
                  Online — {payload.name}
                </ModalTitle>
                <ModalDescription className="text-[#525252]">
                  {payload.version != null
                    ? `Versie ${payload.version} staat live in de garage`
                    : "Je app staat live in de garage"}
                </ModalDescription>
              </div>
            </div>
          </ModalHeader>
        </div>

        <div className="space-y-4 px-4 py-4">
          {payload.liveUrl ? (
            <div>
              <p className="mb-2 text-sm font-medium text-[#171717]">
                Link naar je app
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={payload.liveUrl}
                  aria-label="Live link"
                  className="min-h-[var(--ds-touch-min)] min-w-0 flex-1 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-3 font-mono text-xs text-[#171717]"
                />
                <Button
                  type="button"
                  size="iconTouch"
                  variant="secondary"
                  className="shrink-0 rounded-xl border-[#E5E5E5]"
                  aria-label="Link kopiëren"
                  onClick={() => void handleCopy(payload.liveUrl!, "url")}
                >
                  {copied === "url" ? (
                    <Check className="h-4 w-4 text-[#69C400]" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {payload.embedCode ? (
            <div>
              <p className="mb-2 text-sm font-medium text-[#171717]">
                Code voor op je website
              </p>
              <div className="relative rounded-xl border border-[#E5E5E5] bg-[#171717]">
                <pre className="max-h-28 overflow-x-auto p-3 pr-24 font-mono text-[11px] leading-relaxed text-[#e5e5e5]">
                  <code>{payload.embedCode}</code>
                </pre>
                <Button
                  type="button"
                  size="touch"
                  variant="secondary"
                  className="absolute right-2 top-2 h-auto min-h-[var(--ds-touch-min)] rounded-lg border-[#404040] bg-[#262626] px-3 text-xs text-white"
                  onClick={() => void handleCopy(payload.embedCode!, "embed")}
                >
                  {copied === "embed" ? "Gekopieerd" : "Kopiëren"}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-sm leading-relaxed text-[#737373]">
            Bezoekers kunnen de app op hun telefoon toevoegen via &ldquo;Zet op
            beginscherm&rdquo; in de browser.
          </p>

          <ModalFooter className="flex-wrap justify-start gap-2 pt-1 sm:justify-start">
            <Button
              asChild
              size="touch"
              className="rounded-xl bg-[#69C400] text-white hover:bg-[#5db000]"
            >
              <Link href="/fumero/projecten" onClick={onClose}>
                Naar projecten
              </Link>
            </Button>
            {payload.liveUrl ? (
              <Button
                asChild
                size="touch"
                variant="secondary"
                className="rounded-xl border-[#E5E5E5]"
              >
                <a
                  href={payload.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  App openen
                </a>
              </Button>
            ) : null}
            <details className="relative w-full">
              <summary className="min-h-[var(--ds-touch-min)] cursor-pointer text-sm font-medium text-[#3d7a00] underline-offset-2 hover:underline">
                Meer opties
              </summary>
              <div className="mt-2 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-2">
                <Link
                  href={codeExportHref}
                  className={cn(
                    "flex min-h-[var(--ds-touch-min)] items-center rounded-lg px-3 text-sm text-[#171717] hover:bg-white"
                  )}
                  onClick={onClose}
                >
                  Naar code-werkplek
                </Link>
              </div>
            </details>
          </ModalFooter>
        </div>
      </ModalContent>
    </Modal>
  );
}
