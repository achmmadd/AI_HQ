"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STRATEGIES = [
  { value: "paragraph", label: "Paragraaf (dubbele newline)" },
  { value: "sentence", label: "Zinnen" },
  { value: "fixed", label: "Vaste lengte" },
] as const;

export function KennisbankChunkPreview() {
  const [text, setText] = useState("");
  const [strategy, setStrategy] =
    useState<(typeof STRATEGIES)[number]["value"]>("paragraph");
  const [maxChars, setMaxChars] = useState(1200);
  const [loading, setLoading] = useState(false);
  const [chunks, setChunks] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function preview() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/knowledge/chunk-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          strategy,
          max_chunk_chars: maxChars,
        }),
      });
      const j = (await r.json()) as { chunks?: string[]; error?: string };
      if (!r.ok) throw new Error(j.error || r.statusText);
      setChunks(Array.isArray(j.chunks) ? j.chunks : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview mislukt");
      setChunks([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chunk-preview (vóór ingest)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-text-secondary">
          Plak ruwe tekst om te zien hoe deze in stukken wordt gesplitst. Dit
          voert nog geen Qdrant-upload uit.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="rounded-2xl font-mono text-sm"
          placeholder="Plak documenttekst…"
          aria-label="Tekst voor chunk-preview"
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-text-secondary">
            Strategie
            <select
              className="mt-1 flex h-9 rounded-xl border border-border bg-surface px-2 text-sm"
              value={strategy}
              onChange={(e) =>
                setStrategy(
                  e.target.value as (typeof STRATEGIES)[number]["value"]
                )
              }
              aria-label="Chunk-strategie"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-secondary">
            Max. chars
            <input
              type="number"
              min={200}
              max={4000}
              className="mt-1 flex h-9 w-24 rounded-xl border border-border bg-surface px-2 text-sm"
              value={maxChars}
              onChange={(e) => setMaxChars(Number(e.target.value) || 1200)}
              aria-label="Maximum chunk lengte"
            />
          </label>
          <Button
            type="button"
            className="rounded-xl"
            disabled={loading || !text.trim()}
            onClick={() => void preview()}
          >
            {loading ? "Bezig…" : "Preview chunks"}
          </Button>
        </div>
        {err ? <p className="text-sm text-error">{err}</p> : null}
        {chunks.length > 0 ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
            {chunks.map((c, i) => (
              <li
                key={i}
                className="rounded-lg bg-surface-elevated/40 p-2 text-xs whitespace-pre-wrap text-text-primary"
              >
                <span className="font-mono text-[10px] text-text-secondary">
                  #{i + 1} ({c.length} tekens)
                </span>
                <br />
                {c}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
