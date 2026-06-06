"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/design-system/components";
import { useCompanyStore } from "@/stores/useCompanyStore";

type Hit = {
  id?: unknown;
  score?: number;
  payload?: Record<string, unknown>;
};

function payloadPreview(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "Geen tekst beschikbaar";
  const text =
    (typeof payload.text === "string" && payload.text) ||
    (typeof payload.content === "string" && payload.content) ||
    (typeof payload.chunk === "string" && payload.chunk);
  if (text) return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  return JSON.stringify(payload, null, 2);
}

export function KennisbankSearch() {
  const company = useCompanyStore((s) => s.company);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/qdrant/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, klant: company, limit: 12 }),
      });
      const j = (await r.json()) as {
        error?: string;
        results?: Hit[];
        result?: Hit[];
      };
      if (!r.ok) throw new Error(j.error || r.statusText);
      const result = (j.results ?? j.result) as Hit[] | undefined;
      setHits(Array.isArray(result) ? result : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Zoeken mislukt");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Zoeken in kennisbank</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Typ een vraag of trefwoord. We zoeken in alle documenten van{" "}
          <strong>{company === "bokas" ? "Bokas" : "Fumero"}</strong>.
        </p>
      </div>
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Bijv. retourbeleid of openingstijden"
            touchFriendly
            className="rounded-2xl pl-12"
            aria-label="Zoekterm"
          />
        </div>
        <Button
          type="submit"
          size="touch"
          disabled={loading || !q.trim()}
          className="w-full shrink-0 sm:w-auto"
        >
          {loading ? "Zoeken…" : "Zoeken"}
        </Button>
      </form>
      {err && (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {err}. Probeer het later opnieuw of neem contact op met je beheerder.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {hits.map((h, i) => (
          <motion.div
            key={String(h.id ?? i)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Resultaat {i + 1}
                  {h.score != null ? (
                    <span className="ml-2 text-xs font-normal text-text-secondary">
                      ({Math.round(h.score * 100)}% match)
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-text-secondary">
                <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-elevated p-3 text-text-primary">
                  {payloadPreview(h.payload)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      {!loading && hits.length === 0 && !err && q.trim() && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
          Geen resultaten voor &ldquo;{q.trim()}&rdquo;. Probeer andere woorden of voeg
          eerst kennis toe.
        </p>
      )}
    </div>
  );
}
