"use client";

import { useMemo } from "react";
import { normalizeVanillaAppHtml } from "@/lib/builder-code";

export function CustomAppPreview({
  naam,
  slug,
  code,
}: {
  naam: string;
  slug: string;
  code: string;
}) {
  const srcDoc = useMemo(() => normalizeVanillaAppHtml(code), [code]);
  const openTabHref = useMemo(
    () => `data:text/html;charset=utf-8,${encodeURIComponent(srcDoc)}`,
    [srcDoc]
  );

  return (
    <div className="min-h-dvh bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-3">
        <div className="flex items-center gap-3">
          <a
            href="/builder"
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Builder
          </a>
          <span className="text-slate-600">|</span>
          <h1 className="font-medium text-white">{naam}</h1>
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
            live
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>/apps/{slug}</span>
          <a
            href={openTabHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Open in nieuw tabblad
          </a>
        </div>
      </div>
      <div className="p-6">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <iframe
            title={naam}
            srcDoc={srcDoc}
            className="h-[min(80vh,720px)] w-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
