"use client";

import { useCallback, useState } from "react";
import type { CompanyId } from "@/lib/types";

export type ArtifactState = { html: string; title: string };

export function useArtifact(klant: CompanyId) {
  const [artifact, setArtifact] = useState<ArtifactState | null>(null);
  const [loading, setLoading] = useState(false);

  const buildArtifact = useCallback(
    async (prompt: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/artifact/generate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            klant,
            afdeling: "fabriek",
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          html?: string;
          title?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (!data.html) {
          throw new Error("Geen HTML ontvangen");
        }
        setArtifact({
          html: data.html,
          title: data.title || prompt.slice(0, 48),
        });
      } finally {
        setLoading(false);
      }
    },
    [klant]
  );

  const closeArtifact = useCallback(() => setArtifact(null), []);

  const saveArtifact = useCallback(
    async (art: ArtifactState) => {
      const slugBase = art.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 36);
      const slug = `${slugBase || "app"}-${Date.now().toString(36)}`;
      const res = await fetch("/api/apps", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: art.title,
          slug,
          code: art.html,
          klant,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
    },
    [klant]
  );

  return { artifact, loading, buildArtifact, closeArtifact, saveArtifact };
}
