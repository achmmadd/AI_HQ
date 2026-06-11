"use client";

import { useMemo } from "react";
import type { ArtifactState } from "@/hooks/useArtifact";
import { normalizeVanillaAppHtml } from "@/lib/builder-code.live";

export function ArtifactPreview({ artifact }: { artifact: ArtifactState }) {
  const srcDoc = useMemo(
    () => normalizeVanillaAppHtml(artifact.html),
    [artifact.html],
  );

  return (
    <iframe
      title={artifact.title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin allow-forms"
      className="h-full w-full border-0 bg-background"
    />
  );
}
