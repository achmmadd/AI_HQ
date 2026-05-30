"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeployPreflight = {
  ready?: boolean;
  missing?: string[];
  hint?: string | null;
};

type DeployResponse = {
  success?: boolean;
  live_url?: string;
  repo_url?: string;
  error?: string;
  files_pushed?: number;
  environment?: string;
};

export function DeployButton({
  source,
  klant,
  workspace,
  slug,
  html,
  environment = "production",
  className,
  compact = false,
}: {
  source: "artifact" | "code";
  klant: string;
  workspace?: string;
  slug: string;
  html?: string;
  environment?: "preview" | "production";
  className?: string;
  compact?: boolean;
}) {
  const [preflight, setPreflight] = useState<DeployPreflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  const loadPreflight = useCallback(async () => {
    try {
      const res = await fetch("/api/apps/deploy", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as DeployPreflight;
      setPreflight(data);
    } catch {
      setPreflight({ ready: false, missing: ["preflight_failed"] });
    }
  }, []);

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  async function runDeploy() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        source,
        klant,
        slug,
        environment,
      };
      if (source === "code") {
        if (!workspace) throw new Error("workspace ontbreekt");
        body.workspace = workspace;
      } else if (html) {
        body.html = html;
      }

      const res = await fetch("/api/apps/deploy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as DeployResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (data.live_url) setLiveUrl(data.live_url);
      if (data.repo_url) setRepoUrl(data.repo_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = preflight?.ready ?? false;
  const disabled =
    busy ||
    !ready ||
    (source === "code" && !workspace) ||
    (source === "artifact" && !html?.trim());

  return (
    <div className={cn("space-y-1.5", className)}>
      {!compact && preflight && !ready && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          Deploy niet klaar
          {preflight.missing?.length
            ? `: ${preflight.missing.join(", ")}`
            : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          className={cn("gap-1 text-xs", compact ? "h-8 rounded-xl px-2" : "flex-1")}
          disabled={disabled}
          onClick={() => void runDeploy()}
          title={
            environment === "preview"
              ? "Deploy naar Vercel preview"
              : "Deploy naar Vercel production"
          }
        >
          <Rocket className="h-3.5 w-3.5" />
          {busy
            ? "Deploy…"
            : environment === "preview"
              ? "Preview deploy"
              : "Deploy"}
        </Button>
        {liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-accent hover:bg-surface-elevated"
          >
            <ExternalLink className="h-3 w-3" />
            Live
          </a>
        )}
        {repoUrl && !compact && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-text-secondary underline-offset-2 hover:underline"
          >
            GitHub
          </a>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-red-500 whitespace-pre-wrap">{error}</p>
      )}
    </div>
  );
}
