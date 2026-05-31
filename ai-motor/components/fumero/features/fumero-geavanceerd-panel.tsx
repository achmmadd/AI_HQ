"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showFumeroToast } from "@/lib/fumero/fumero-toast";
import { cn } from "@/lib/utils";

type TabId = "files" | "code" | "more";

type ToolVersionRow = {
  id: number;
  version: number;
  code: string;
  status: string;
};

export function FumeroGeavanceerdPanel({
  open,
  onClose,
  toolId,
  toolSlug,
  embedCode,
  appSlug,
}: {
  open: boolean;
  onClose: () => void;
  toolId: number | null;
  toolSlug: string | null;
  embedCode: string | null;
  appSlug: string | null;
}) {
  const [tab, setTab] = useState<TabId>("files");
  const [html, setHtml] = useState<string | null>(null);
  const [versions, setVersions] = useState<ToolVersionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTool = useCallback(async () => {
    if (!toolId) {
      setHtml(null);
      setVersions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/fumero/tools/${toolId}`, {
        credentials: "include",
      });
      const data = (await res.json()) as {
        versions?: ToolVersionRow[];
        concept?: { version: number } | null;
      };
      if (!res.ok) throw new Error("Tool laden mislukt");
      const vers = data.versions ?? [];
      setVersions(vers);
      const concept = vers.find((v) => v.status === "concept");
      const published = vers.filter((v) => v.status === "published").pop();
      setHtml(concept?.code ?? published?.code ?? vers[0]?.code ?? null);
    } catch {
      setHtml(null);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    if (open) void loadTool();
  }, [open, loadTool]);

  if (!open) return null;

  const codeHref = toolSlug
    ? `/fumero/code?import=fumero-tool&slug=${encodeURIComponent(toolSlug)}`
    : toolId
      ? `/fumero/code?import=fumero-tool&tool=${toolId}`
      : "/fumero/code";

  const tabs: { id: TabId; label: string }[] = [
    { id: "files", label: "Bestanden" },
    { id: "code", label: "Code" },
    { id: "more", label: "Meer" },
  ];

  const downloadHtml = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${toolSlug ?? "tool"}-concept.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyEmbed = async () => {
    if (!embedCode) return;
    try {
      await navigator.clipboard.writeText(embedCode);
      showFumeroToast("Embed-code gekopieerd");
    } catch {
      showFumeroToast("Kopiëren mislukt", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fumero-geavanceerd-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[#E5E5E5] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3">
          <h2 id="fumero-geavanceerd-title" className="text-[15px] font-semibold text-[#171717]">
            Geavanceerd
          </h2>
          <button
            type="button"
            className="rounded-lg p-1 text-[#737373] hover:bg-[#FAFAFA] hover:text-[#171717]"
            aria-label="Sluiten"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[#E5E5E5] px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === t.id
                  ? "bg-[#FAFAFA] text-[#171717]"
                  : "text-[#737373] hover:text-[#171717]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "files" ? (
            !toolId ? (
              <p className="text-[13px] text-[#737373]">
                Bouw eerst een tool — daarna zie je hier de HTML en downloadopties.
              </p>
            ) : loading ? (
              <p className="text-[13px] text-[#737373]">Laden…</p>
            ) : html ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 rounded-lg border-[#E5E5E5] text-xs"
                    onClick={downloadHtml}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Download HTML
                  </Button>
                </div>
                <pre className="max-h-[min(50vh,24rem)] overflow-auto rounded-lg border border-[#E5E5E5] bg-[#171717] p-3 font-mono text-[10px] leading-relaxed text-[#e5e5e5]">
                  <code>{html.slice(0, 12000)}{html.length > 12000 ? "\n…" : ""}</code>
                </pre>
              </div>
            ) : (
              <p className="text-[13px] text-[#737373]">Geen HTML beschikbaar.</p>
            )
          ) : null}

          {tab === "code" ? (
            <div className="space-y-3">
              <p className="text-[13px] text-[#525252]">
                Bewerk de volledige tool-code in de Code workspace.
              </p>
              <Link
                href={codeHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#69C400] px-3 text-[12px] font-medium text-white hover:bg-[#5db000]"
                onClick={onClose}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Code workspace
              </Link>
            </div>
          ) : null}

          {tab === "more" ? (
            <div className="space-y-4 text-[13px] text-[#525252]">
              {versions.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
                    Versies
                  </p>
                  <ul className="space-y-1">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex justify-between rounded-md border border-[#E5E5E5] px-2 py-1.5 text-[12px]"
                      >
                        <span>v{v.version}</span>
                        <span className="text-[#737373]">{v.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {embedCode ? (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
                    Embed
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 rounded-lg border-[#E5E5E5] text-xs"
                    onClick={() => void copyEmbed()}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Embed kopiëren
                  </Button>
                </div>
              ) : null}
              {appSlug ? (
                <Link
                  href={`/fumero/bouwen?app=${encodeURIComponent(appSlug)}`}
                  className="block text-[#3d7a00] hover:underline"
                  onClick={onClose}
                >
                  App-data beheren in Bouwen
                </Link>
              ) : null}
              <Link
                href="/fumero/projecten"
                className="block text-[#3d7a00] hover:underline"
                onClick={onClose}
              >
                Alle projecten in Projecten
              </Link>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
                  Binnenkort
                </p>
                <ul className="space-y-1.5 text-[12px] text-[#737373]">
                  <li className="rounded-md border border-dashed border-[#E5E5E5] px-2 py-1.5">
                    Copywriter — NL webshop-copy
                  </li>
                  <li className="rounded-md border border-dashed border-[#E5E5E5] px-2 py-1.5">
                    SEO — meta, structuur en keywords
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
