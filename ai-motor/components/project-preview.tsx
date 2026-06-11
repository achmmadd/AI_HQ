"use client";

import { useMemo, useState } from "react";
import { Code, Copy, ExternalLink, Eye, FolderGit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeployButton } from "@/components/DeployButton";
import { cn } from "@/lib/utils";
import { PLAYABLE_PREVIEW_SANDBOX } from "@/lib/fumero/preview-interactive";
import type { ProjectFiles } from "@/lib/project-types";

export function ProjectPreview({
  title,
  files,
  previewHtml,
  stackLabel,
  klant = "fumero",
  onClose,
  onSave,
}: {
  title: string;
  files: ProjectFiles;
  previewHtml: string;
  stackLabel?: string | null;
  klant?: string;
  onClose: () => void;
  onSave?: () => Promise<void>;
}) {
  const fileNames = useMemo(
    () => Object.keys(files).sort((a, b) => a.localeCompare(b)),
    [files]
  );
  const [activeFile, setActiveFile] = useState(fileNames[0] ?? "index.html");
  const [tab, setTab] = useState<"preview" | "files">("preview");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingCode, setOpeningCode] = useState(false);

  const currentCode = files[activeFile] ?? "";

  const copyCode = () => {
    void navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openBlob = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  };

  const openInCode = async () => {
    setOpeningCode(true);
    try {
      const res = await fetch("/api/code/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klant, title, files }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch {
      /* user sees no navigation */
    } finally {
      setOpeningCode(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-elevated/30">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-text-primary">{title}</p>
          <p className="text-[10px] text-text-secondary">
            {stackLabel ? `${stackLabel} · ` : ""}
            {fileNames.length} bestanden
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 rounded-xl px-2 text-xs"
            disabled={openingCode}
            onClick={() => void openInCode()}
            title="Open in Code workspace"
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            {openingCode ? "…" : "Code"}
          </Button>
          {onSave && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1 rounded-xl px-2 text-xs"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onSave()
                  .catch(() => {})
                  .finally(() => setSaving(false));
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "…" : "Opslaan"}
            </Button>
          )}
          <DeployButton
            source="artifact"
            klant={klant}
            slug={title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase().slice(0, 32) || "artifact"}
            html={previewHtml}
            environment="production"
            compact
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-xl px-2"
            onClick={copyCode}
            title="Kopieer bestand"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "✓" : ""}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-xl px-2"
            onClick={openBlob}
            title="Open preview"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-xl px-2"
            onClick={onClose}
            title="Sluiten"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-border">
        {(
          [
            ["preview", Eye, "Preview"],
            ["files", Code, "Bestanden"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
              tab === id
                ? "border-b-2 border-accent text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Icon className="h-3.5 w-3.5 opacity-80" />
            {label}
          </button>
        ))}
      </div>

      {tab === "preview" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <iframe
            title={title}
            srcDoc={previewHtml}
            sandbox={PLAYABLE_PREVIEW_SANDBOX}
            className="pointer-events-auto h-full w-full border-0 bg-background"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
            {fileNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setActiveFile(name)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-mono",
                  activeFile === name
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:bg-surface-elevated"
                )}
              >
                {name}
              </button>
            ))}
          </div>
          <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
            {currentCode}
          </pre>
        </div>
      )}
    </div>
  );
}
