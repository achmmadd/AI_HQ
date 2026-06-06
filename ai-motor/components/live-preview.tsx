"use client";

import { useMemo } from "react";
import { normalizeVanillaAppHtml } from "@/lib/builder-code.live";
import { PLAYABLE_PREVIEW_SANDBOX } from "@/lib/fumero/preview-interactive";

export function LivePreview({
  code,
  title,
  className,
}: {
  code: string;
  title: string;
  className?: string;
}) {
  const srcDoc = useMemo(() => {
    const raw = code.trim() || "<p class=\"p-8 text-center text-slate-400\">Geen preview</p>";
    return normalizeVanillaAppHtml(raw);
  }, [code]);

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      sandbox={PLAYABLE_PREVIEW_SANDBOX}
      className={className ?? "h-full min-h-[320px] w-full rounded-xl border border-border bg-white"}
    />
  );
}
