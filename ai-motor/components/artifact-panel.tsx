"use client";

import { useState } from "react";
import { Code, Copy, ExternalLink, Eye, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ArtifactPanel({
  html,
  title,
  onClose,
  onSave,
}: {
  html: string;
  title: string;
  onClose: () => void;
  onSave?: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const copyCode = () => {
    void navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openBlob = () => {
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-elevated/30">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-text-primary">{title}</p>
          <p className="text-[10px] text-text-secondary">Artifact · Dify</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-xl px-2"
            onClick={copyCode}
            title="Kopieer HTML"
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
            title="Open in nieuw tabblad"
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
            ["code", Code, "Code"],
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "preview" ? (
          <iframe
            title={title}
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <pre className="h-full overflow-auto p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
            {html}
          </pre>
        )}
      </div>
    </div>
  );
}
