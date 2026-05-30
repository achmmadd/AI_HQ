"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";

type CatalogRow = {
  id: number;
  filename: string;
  category: string | null;
  chunk_count: number;
  content_sha256_short: string;
  canonical_source: string | null;
  created_at: string;
};

export function KennisbankCatalog() {
  const company = useCompanyStore((s) => s.company);
  const klantOk = company === "fumero" || company === "bokas";
  const [docs, setDocs] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!klantOk) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/knowledge/catalog?klant=${encodeURIComponent(company)}`,
        { credentials: "include" }
      );
      const j = (await res.json()) as {
        documents?: CatalogRow[];
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error || `HTTP ${res.status}`);
        setDocs([]);
        return;
      }
      setDocs(Array.isArray(j.documents) ? j.documents : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [company, klantOk]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!klantOk) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Kennis-register</CardTitle>
          <CardDescription>
            Wat staat er in SQLite (één bron per upload). Qdrant bevat chunks;
            gebruik deze lijst om verouderde of dubbele bronnen op te ruimen.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Laden…" : "Verversen"}
        </Button>
      </CardHeader>
      <CardContent>
        {err ? (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nog geen documenten geïndexeerd voor deze werkruimte.
          </p>
        ) : (
          <div className="max-h-[min(420px,50vh)] overflow-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-elevated/95 backdrop-blur">
                <tr className="border-b border-border text-text-secondary">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Bestand</th>
                  <th className="px-2 py-2 font-medium">Cat.</th>
                  <th className="px-2 py-2 font-medium">Bron (SSOT)</th>
                  <th className="px-2 py-2 font-medium">Chunks</th>
                  <th className="px-2 py-2 font-medium">SHA</th>
                  <th className="px-2 py-2 font-medium">Toegevoegd</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 align-top hover:bg-surface-elevated/40"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-text-secondary">
                      {r.id}
                    </td>
                    <td className="max-w-[200px] break-words px-2 py-1.5">
                      {r.filename}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {r.category || "—"}
                    </td>
                    <td className="max-w-[220px] break-all px-2 py-1.5 text-text-secondary">
                      {r.canonical_source || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {r.chunk_count}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-text-secondary">
                      {r.content_sha256_short}…
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-text-secondary">
                      {r.created_at?.slice(0, 19) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
