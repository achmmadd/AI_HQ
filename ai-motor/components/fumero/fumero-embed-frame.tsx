"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { normalizeVanillaAppHtml } from "@/lib/builder-code";

/**
 * Full-bleed, chrome-loze render van een gegenereerde Fumero-tool. Gebruikt
 * voor live preview, de publieke klantpagina en de widget-iframe —
 * de bezoeker ziet uitsluitend de app zelf (geen studio-chrome).
 */
export function FumeroEmbedFrame({
  naam,
  code,
}: {
  naam: string;
  code: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const srcDoc = useMemo(() => {
    try {
      return normalizeVanillaAppHtml(code);
    } catch {
      return "";
    }
  }, [code]);

  if (!code?.trim() || !srcDoc.trim()) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-2 bg-[var(--fumero-surface-muted)] p-8 text-center">
        <p className="text-sm font-medium text-[var(--fumero-text)]">Geen preview beschikbaar</p>
        <p className="text-xs text-[var(--fumero-text-muted)]">App-code ontbreekt of is ongeldig.</p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-[var(--fumero-surface-muted)] p-8 text-center">
        <AlertTriangle className="h-7 w-7 text-amber-500" />
        <p className="text-sm font-medium text-[var(--fumero-text)]">Preview kon niet laden</p>
        <p className="max-w-sm text-xs text-[var(--fumero-text-muted)]">
          De app kon niet worden weergegeven in het iframe.
        </p>
      </div>
    );
  }

  return (
    <iframe
      title={naam}
      srcDoc={srcDoc}
      className="h-dvh w-full border-0 bg-[var(--fumero-surface)]"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      onError={() => setLoadFailed(true)}
    />
  );
}
