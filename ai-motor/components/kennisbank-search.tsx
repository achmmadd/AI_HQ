"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyStore } from "@/stores/useCompanyStore";

type Hit = {
  id?: unknown;
  score?: number;
  payload?: Record<string, unknown>;
};

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
      const j = await r.json();
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
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek in kennisbank (embed + Qdrant)…"
            className="rounded-2xl pl-10"
          />
        </div>
        <Button type="submit" disabled={loading} className="rounded-2xl">
          {loading ? "Zoeken…" : "Zoek"}
        </Button>
      </form>
      {err && (
        <p className="text-sm text-error">
          {err} · Controleer Ollama, Qdrant en collectie <code className="text-xs">factory_os</code>.
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
                <CardTitle className="text-sm font-medium">
                  Score: {h.score != null ? h.score.toFixed(4) : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-text-secondary">
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-elevated p-3 text-xs text-text-primary">
                  {JSON.stringify(h.payload ?? h, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      {!loading && hits.length === 0 && !err && (
        <p className="text-center text-sm text-text-secondary">
          Geen resultaten. Filter op client: <strong>{company}</strong>.
        </p>
      )}
    </div>
  );
}
