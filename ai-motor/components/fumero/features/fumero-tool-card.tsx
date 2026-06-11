"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FumeroSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { cacheBustPreviewUrl } from "@/lib/fumero/builder-config";
import { fumeroConceptVersionLabel } from "@/lib/fumero/content-preview";
import { deployTypeLabel } from "@/lib/fumero/tool-templates";
import { FumeroBuildTimeline } from "@/components/fumero/features/fumero-build-timeline";
import { cn } from "@/lib/utils";
import type { FumeroToolCardPayload } from "@/lib/motors-chat-types";

function ToolCardMoreMenu({
  open,
  onClose,
  onPreview,
  onRefine,
  onCopyEmbed,
  embed,
  copied,
  previewSrc,
  onToggleDetails,
  detailsOpen,
  codeWorkspaceHref,
}: {
  open: boolean;
  onClose: () => void;
  onPreview?: () => void;
  onRefine?: () => void;
  onCopyEmbed?: () => void;
  embed?: string | null;
  copied: boolean;
  previewSrc?: string | null;
  onToggleDetails: () => void;
  detailsOpen: boolean;
  codeWorkspaceHref?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="fumero-tool-card-menu absolute right-0 top-full z-20 mt-1 min-w-[168px] overflow-hidden rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] py-1 shadow-md"
      role="menu"
    >
      {onPreview ? (
        <button
          type="button"
          role="menuitem"
          className="ios-tap-highlight flex w-full items-center px-3 py-2 text-left text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
          onClick={() => {
            onPreview();
            onClose();
          }}
        >
          Preview
        </button>
      ) : null}
      {onRefine ? (
        <button
          type="button"
          role="menuitem"
          className="ios-tap-highlight flex w-full items-center px-3 py-2 text-left text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
          onClick={() => {
            onRefine();
            onClose();
          }}
        >
          Verfijn
        </button>
      ) : null}
      {embed ? (
        <button
          type="button"
          role="menuitem"
          className="ios-tap-highlight flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
          onClick={() => {
            onCopyEmbed?.();
            onClose();
          }}
        >
          <Copy className="h-3 w-3 shrink-0" />
          {copied ? "Gekopieerd" : "Embed kopiëren"}
        </button>
      ) : null}
      <Link
        href="/fumero/projecten"
        role="menuitem"
        className="ios-tap-highlight flex w-full items-center px-3 py-2 text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
        onClick={onClose}
      >
        Open in Projecten
      </Link>
      {codeWorkspaceHref ? (
        <Link
          href={codeWorkspaceHref}
          role="menuitem"
          className="ios-tap-highlight flex w-full items-center px-3 py-2 text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
          onClick={onClose}
        >
          Open in Code workspace
        </Link>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="ios-tap-highlight flex w-full items-center px-3 py-2 text-left text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
        onClick={() => {
          onToggleDetails();
          onClose();
        }}
      >
        {detailsOpen ? "Verberg details" : "Details"}
      </button>
      {previewSrc ? (
        <a
          href={previewSrc}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          className="ios-tap-highlight flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[var(--fumero-text)] hover:bg-[var(--fumero-hover-overlay)]"
          onClick={onClose}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          Open in nieuw tabblad
        </a>
      ) : null}
    </div>
  );
}

export function FumeroToolCard({
  card,
  busy,
  builderLabel,
  onRefine,
  onDeploy,
  splitPreviewOpen = false,
  summary,
  onFocusPreview,
  onFocusComposer,
  buildPhase,
  building,
}: {
  card: FumeroToolCardPayload;
  busy?: boolean;
  builderLabel?: string;
  onRefine: (instruction: string) => Promise<void>;
  onDeploy: () => Promise<void>;
  /** Coder split: geen iframe/embed/Pas aan in thread — preview rechts. */
  splitPreviewOpen?: boolean;
  /** Eén regel onder de kaart (build-samenvatting). */
  summary?: string;
  onFocusPreview?: () => void;
  onFocusComposer?: () => void;
  buildPhase?: string;
  building?: boolean;
}) {
  const [refine, setRefine] = useState("");
  const [refining, setRefining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const prevStatus = useRef(card.status);
  const embed = card.embedCode || card.internalUrl;
  const liveUrl = card.internalUrl || card.embedCode || null;

  const extras = card as FumeroToolCardPayload & {
    tables?: number;
    authRequired?: boolean;
    hasPwa?: boolean;
  };
  const toolSlug = card.slug;
  const codeWorkspaceHref =
    card.toolId && toolSlug
      ? `/code?import=fumero-tool&slug=${encodeURIComponent(toolSlug)}`
      : card.toolId
        ? `/code?import=fumero-tool&tool=${card.toolId}`
        : null;
  const isAppCard = !card.toolId || !!toolSlug;
  const tablesCount = extras.tables;
  const authRequired = extras.authRequired ?? card.deployType === "internal";
  const hasPwa = extras.hasPwa ?? true;

  const isGenerating = card.status === "generating";
  const isWorking = busy || refining || isGenerating;
  const hasPreview = Boolean(card.previewUrl);
  const badge = builderLabel ?? card.builderLabel;

  const versionLabel = useMemo(() => {
    if (card.status === "published" && card.version != null) {
      return `live · v${card.version}`;
    }
    if (card.status === "published") return "live";
    if (card.version != null) return fumeroConceptVersionLabel(card.version);
    return "concept";
  }, [card.status, card.version]);

  const previewSrc = useMemo(
    () => cacheBustPreviewUrl(card.previewUrl, card.previewEpoch ?? undefined),
    [card.previewUrl, card.previewEpoch]
  );

  const overlayText = refining
    ? "Verfijnen…"
    : isGenerating && !splitPreviewOpen
      ? "Genereren…"
      : null;

  useEffect(() => {
    if (prevStatus.current !== "published" && card.status === "published") {
      setDeploySuccess(true);
      setDetailsOpen(true);
      const t = window.setTimeout(() => setDeploySuccess(false), 8000);
      prevStatus.current = card.status;
      return () => window.clearTimeout(t);
    }
    prevStatus.current = card.status;
  }, [card.status]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleRefine = async (instruction: string) => {
    const t = instruction.trim();
    if (!t || isWorking) return;
    setRefining(true);
    try {
      await onRefine(t);
    } finally {
      setRefining(false);
    }
  };

  if (splitPreviewOpen) {
    return (
      <div className="fumero-tool-card-compact mt-2 overflow-visible rounded-lg border border-[var(--fumero-border)]/80 bg-[var(--fumero-surface)]">
        {deploySuccess ? (
          <div className="fumero-deploy-success flex flex-wrap items-center gap-2 border-b border-[var(--fumero-success-border)] bg-[var(--fumero-accent-muted)] px-3 py-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)]">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <p className="text-[13px] font-medium leading-none text-[var(--fumero-success-fg)]">
              Live in garage
              {card.version != null ? ` — v${card.version}` : ""}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[14px] font-semibold leading-tight text-[var(--fumero-text)]">
                {card.name}
              </p>
              <span className="shrink-0 rounded-full bg-[var(--fumero-success-bg)] px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--fumero-success-fg)]">
                {versionLabel}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-none text-[var(--fumero-text-muted)]">
              {deployTypeLabel(card.deployType)}
            </p>
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isWorking || (!card.toolId && !extras.slug)}
              className={cn(
                "h-8 rounded-lg px-3 text-[12px] font-medium shadow-none",
                card.status === "published" && !busy
                  ? "bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)] hover:bg-[var(--fumero-accent-hover)]"
                  : "bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)] hover:bg-[var(--fumero-accent-hover)]"
              )}
              onClick={() => void onDeploy()}
            >
              {busy && !refining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Rocket className="mr-1.5 h-3.5 w-3.5" />
                  {card.status === "published" ? "Opnieuw deployen" : "Deploy naar garage"}
                </>
              )}
            </Button>
            <button
              type="button"
              className="ios-tap-highlight inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-hover-overlay)]"
              aria-label="Meer opties"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <ToolCardMoreMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              onPreview={onFocusPreview}
              onRefine={onFocusComposer}
              onCopyEmbed={embed ? () => void handleCopy(embed) : undefined}
              embed={embed}
              copied={copied}
              previewSrc={previewSrc}
              onToggleDetails={() => setDetailsOpen((v) => !v)}
              detailsOpen={detailsOpen}
              codeWorkspaceHref={
                card.deployType === "internal" ? codeWorkspaceHref : null
              }
            />
          </div>
        </div>

        {detailsOpen ? (
          <div className="space-y-2 border-t border-[var(--fumero-border)]/80 px-3 py-2">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {tablesCount != null ? (
                <span className="rounded bg-[var(--fumero-chip-bg)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">
                  {tablesCount} tabellen
                </span>
              ) : (
                <span className="rounded bg-[var(--fumero-chip-bg)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">
                  Data opslag
                </span>
              )}
              {hasPwa && (
                <span className="rounded bg-[var(--fumero-chip-bg)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">
                  PWA
                </span>
              )}
              {authRequired && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                  Login vereist
                </span>
              )}
              {card.deployType === "customer" && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                  Publiek embed
                </span>
              )}
              {badge && isWorking ? (
                <span className="rounded bg-[var(--fumero-chip-bg)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">
                  {badge}
                </span>
              ) : null}
              {card.status === "published" &&
              card.statsViews != null &&
              card.statsViews > 0 ? (
                <span className="rounded bg-[var(--fumero-chip-bg)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">
                  {card.statsViews} weergaven
                </span>
              ) : null}
            </div>
            {(building || buildPhase) && detailsOpen && !splitPreviewOpen ? (
              <FumeroBuildTimeline
                activePhase={buildPhase}
                building={building ?? isWorking}
                compact
              />
            ) : null}
            {embed && embedOpen ? (
              <div className="relative rounded-lg border border-[var(--fumero-border)] bg-[#171717]">
                <pre className="max-h-24 overflow-x-auto p-2 pr-14 font-mono text-[10px] leading-relaxed text-[#e5e5e5]">
                  <code>{embed}</code>
                </pre>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 top-1.5 h-6 rounded-md border border-[#404040] bg-[#262626] px-1.5 text-[10px] text-white hover:bg-[#404040]"
                  onClick={() => void handleCopy(embed)}
                >
                  {copied ? "✓" : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ) : embed ? (
              <button
                type="button"
                className="text-[12px] font-medium text-[var(--fumero-success-fg)] underline-offset-2 hover:underline"
                onClick={() => setEmbedOpen(true)}
              >
                Embed tonen
              </button>
            ) : null}
          </div>
        ) : null}

        {summary && !isWorking ? (
          <p className="border-t border-[var(--fumero-border)]/60 px-3 py-2 text-[13px] leading-snug text-[var(--fumero-text-muted)]">
            {summary}
          </p>
        ) : null}

        {splitPreviewOpen && hasPreview && !isWorking ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--fumero-border)]/60 px-3 py-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg border-[var(--fumero-border)] text-[12px] text-[var(--fumero-text)]"
              onClick={() => onFocusPreview?.()}
            >
              Test in preview
            </Button>
            {embed ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg bg-[var(--fumero-inverse-bg)] text-[12px] text-[var(--fumero-inverse-text)] hover:bg-black"
                onClick={() => void handleCopy(embed)}
              >
                Embed op site
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
      {deploySuccess ? (
        <div className="fumero-deploy-success flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fumero-success-border)] bg-[var(--fumero-accent-muted)] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)]">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <p className="text-sm font-medium text-[var(--fumero-success-fg)]">
              ✓ Live in garage
              {card.version != null ? ` — v${card.version}` : ""}
            </p>
            <Link
              href="/fumero/projecten"
              className="text-xs font-medium text-[var(--fumero-success-fg)] underline-offset-2 hover:underline"
            >
              Open in Projecten →
            </Link>
          </div>
          {liveUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 rounded-md border border-[var(--fumero-success-border)] bg-[var(--fumero-surface)] px-2 text-xs text-[var(--fumero-success-fg)] hover:bg-[var(--fumero-accent-muted)]"
              onClick={() => void handleCopy(liveUrl)}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Gekopieerd
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Embed kopiëren
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 transition-colors",
          deploySuccess && "bg-[var(--fumero-surface)]"
        )}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--fumero-text)]">{card.name}</p>
            {card.version != null && card.status !== "published" ? (
              <span className="rounded-full bg-[var(--fumero-success-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--fumero-success-fg)]">
                v{card.version}
              </span>
            ) : null}
            {badge && (isWorking || card.status !== "published") ? (
              <span className="rounded border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--fumero-text-muted)]">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[var(--fumero-text-muted)]">
            {deployTypeLabel(card.deployType)}
            {card.status === "published" ? " · live" : ` · ${versionLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {previewSrc ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
              onClick={() => onFocusPreview?.()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open preview
            </button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={isWorking || (!card.toolId && !extras.slug)}
            className={cn(
              "h-8 rounded-lg shadow-none transition-colors",
              card.status === "published" && !busy
                ? "bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)] hover:bg-[var(--fumero-accent-hover)]"
                : "bg-[var(--fumero-inverse-bg)] text-[var(--fumero-inverse-text)] hover:bg-black"
            )}
            onClick={() => void onDeploy()}
          >
            {busy && !refining ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Bezig…
              </>
            ) : card.status === "published" ? (
              <>
                <Rocket className="mr-1 h-3.5 w-3.5" />
                Opnieuw deployen
              </>
            ) : (
              <>
                <Rocket className="mr-1 h-3.5 w-3.5" />
                Deploy naar garage
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="relative min-h-[120px] bg-[var(--fumero-surface-muted)]">
        {previewSrc ? (
          <iframe
            key={card.previewEpoch ?? card.previewUrl ?? "preview"}
            title={`Preview ${card.name}`}
            src={previewSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="pointer-events-auto h-[140px] w-full border-0 bg-[var(--fumero-surface)]"
          />
        ) : isWorking ? (
          <div className="flex h-[120px] flex-col gap-2 p-3">
            <FumeroSkeleton className="h-4 w-1/3" />
            <FumeroSkeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : (
          <div className="flex h-[120px] items-center justify-center text-sm text-[var(--fumero-text-muted)]">
            Preview wordt gegenereerd…
          </div>
        )}
        {overlayText ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--fumero-surface)]/80 backdrop-blur-[2px]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--fumero-text-muted)]" aria-hidden />
            <span className="text-sm font-medium text-[var(--fumero-text-muted)]">{overlayText}</span>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 flex flex-wrap gap-1.5 text-[10px]">
        {tablesCount != null ? (
          <span className="rounded bg-[var(--fumero-border)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">{tablesCount} tabellen</span>
        ) : (
          <span className="rounded bg-[var(--fumero-border)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">Data opslag</span>
        )}
        {hasPwa && <span className="rounded bg-[var(--fumero-border)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">PWA</span>}
        {authRequired && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Login vereist</span>}
        {card.deployType === "customer" && <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">Publiek embed</span>}
        {card.deployType === "widget" && !isAppCard && <span className="rounded bg-[var(--fumero-border)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">Widget</span>}
        <span className="rounded bg-[var(--fumero-border)] px-1.5 py-0.5 text-[var(--fumero-text-muted)]">{versionLabel}</span>
      </div>

      <div className="border-t border-[var(--fumero-border)] p-3 space-y-2">
        <label className="block text-xs font-medium text-[var(--fumero-text-muted)]">Pas aan</label>
        <div className="flex gap-2">
          <Input
            className="h-9 flex-1 rounded-lg border-[var(--fumero-border)] text-sm"
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            placeholder="bv. maak de knop groen, voeg een vraag toe"
            disabled={isWorking}
            onKeyDown={(e) => {
              if (e.key === "Enter" && refine.trim()) {
                e.preventDefault();
                const t = refine.trim();
                setRefine("");
                void handleRefine(t);
              }
            }}
          />
          <Button
            type="button"
            className="h-9 min-w-[88px] rounded-lg bg-[var(--fumero-accent)] shadow-none hover:bg-[var(--fumero-accent-hover)]"
            disabled={isWorking || !refine.trim()}
            onClick={() => {
              const t = refine.trim();
              setRefine("");
              void handleRefine(t);
            }}
          >
            {refining ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Verfijnen…
              </span>
            ) : (
              "Verfijn"
            )}
          </Button>
        </div>
      </div>

      {embed ? (
        <div className="border-t border-[var(--fumero-border)] p-3">
          <button
            type="button"
            className="mb-1.5 text-xs font-medium text-[var(--fumero-success-fg)] underline-offset-2 hover:underline"
            onClick={() => setEmbedOpen((v) => !v)}
          >
            {embedOpen ? "Embed verbergen" : "Embed kopiëren"}
          </button>
          {embedOpen ? (
            <div className="relative rounded-lg border border-[var(--fumero-border)] bg-[#171717]">
              <pre className="max-h-28 overflow-x-auto p-3 pr-16 font-mono text-[11px] leading-relaxed text-[#e5e5e5]">
                <code>{embed}</code>
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 h-7 rounded-md border border-[#404040] bg-[#262626] px-2 text-xs text-white hover:bg-[#404040]"
                onClick={() => void handleCopy(embed)}
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Gekopieerd
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3" />
                    Kopieer
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <p className="border-t border-[var(--fumero-border)]/60 px-3 py-2 text-[13px] leading-snug text-[var(--fumero-text-muted)]">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
