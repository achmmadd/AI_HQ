"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "product",
  "process",
  "policy",
  "compliance",
  "contact",
  "other",
] as const;

const STRATEGIES = [
  { value: "paragraph", label: "Paragraaf" },
  { value: "sentence", label: "Zinnen" },
  { value: "fixed", label: "Vaste lengte" },
] as const;

export function KennisbankFileIngest() {
  const company = useCompanyStore((s) => s.company);
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("product");
  const [tags, setTags] = useState("");
  const [canonicalSource, setCanonicalSource] = useState("");
  const [strategy, setStrategy] =
    useState<(typeof STRATEGIES)[number]["value"]>("paragraph");
  const [maxChars, setMaxChars] = useState(1200);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const klantOk = company === "fumero" || company === "bokas";

  async function ingest() {
    if (!file || !klantOk) return;
    setLoading(true);
    setMessage(null);
    setDetail(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("klant", company);
      fd.set("category", category);
      fd.set("tags", tags);
      fd.set("strategy", strategy);
      fd.set("max_chunk_chars", String(maxChars));
      if (canonicalSource.trim()) {
        fd.set("canonical_source", canonicalSource.trim().slice(0, 512));
      }

      const res = await fetch("/api/knowledge/ingest-file", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const j = (await res.json()) as {
        error?: string;
        message?: string;
        duplicate_document_id?: number;
        document_id?: number;
        chunk_count?: number;
        collection?: string;
        upserted?: number;
        warnings?: string[];
      };

      if (res.status === 409) {
        setMessage(j.message || "Duplicaat document");
        setDetail(
          j.duplicate_document_id != null
            ? `Bestaand document-id: ${j.duplicate_document_id}`
            : null
        );
        return;
      }

      if (!res.ok) {
        setMessage(j.error || res.statusText);
        return;
      }

      const warns =
        Array.isArray(j.warnings) && j.warnings.length > 0
          ? `\nWaarschuwingen: ${j.warnings.join(" · ")}`
          : "";
      setMessage(
        `Geïndexeerd: ${j.chunk_count} chunks → ${j.collection} (document #${j.document_id}).${warns}`
      );
      setFile(null);
      setCanonicalSource("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ingest mislukt");
    } finally {
      setLoading(false);
    }
  }

  const selectClass =
    "mt-1 flex h-10 w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text-primary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bestand indexeren (Qdrant)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-text-secondary">
          PDF, DOCX, TXT of MD → tekst → chunk → embed (Ollama) → upsert in de
          collectie <code className="rounded bg-muted px-1">factory_os_[klant]</code>.
          Dubbele inhoud (zelfde hash) wordt geweigerd.
        </p>

        {!klantOk && (
          <p className="text-sm text-error" role="alert">
            Kies Fumero of Bokas in de sidebar — file-ingest is per klant
            geïsoleerd.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-text-secondary" htmlFor="kb-fi-cat">
              Categorie
            </label>
            <select
              id="kb-fi-cat"
              className={selectClass}
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as (typeof CATEGORIES)[number])
              }
              disabled={loading || !klantOk}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-text-secondary" htmlFor="kb-fi-tags">
              Tags (komma)
            </label>
            <input
              id="kb-fi-tags"
              className={selectClass}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tone, hhc, 18plus"
              disabled={loading || !klantOk}
            />
          </div>
        </div>

        <div>
          <label
            className="text-sm text-text-secondary"
            htmlFor="kb-fi-canonical"
          >
            Waarheid / bron (optioneel)
          </label>
          <input
            id="kb-fi-canonical"
            className={selectClass}
            value={canonicalSource}
            onChange={(e) => setCanonicalSource(e.target.value)}
            placeholder="URL of pad naar SSOT — zichtbaar in chat-retrieval"
            disabled={loading || !klantOk}
          />
          <p className="mt-1 text-[11px] text-text-secondary">
            Wordt in Qdrant bij elke chunk opgeslagen zodat prompts herkomst tonen.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-text-secondary">
            Chunk-strategie
            <select
              className={`${selectClass} mt-1 h-9`}
              value={strategy}
              onChange={(e) =>
                setStrategy(e.target.value as (typeof STRATEGIES)[number]["value"])
              }
              disabled={loading || !klantOk}
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
              className={`${selectClass} mt-1 h-9 w-28`}
              value={maxChars}
              onChange={(e) => setMaxChars(Number(e.target.value) || 1200)}
              disabled={loading || !klantOk}
              aria-label="Maximum chunk lengte"
            />
          </label>
        </div>

        <div>
          <label
            className="text-sm text-text-secondary"
            htmlFor="kb-fi-file"
          >
            Bestand
          </label>
          <input
            id="kb-fi-file"
            type="file"
            accept=".pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="mt-2 block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-surface-elevated file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary"
            disabled={loading || !klantOk}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {message && (
          <p
            className={cn(
              "whitespace-pre-wrap text-sm",
              message.includes("mislukt") ||
                message.includes("Duplicaat") ||
                message.includes("Fout")
                ? "text-error"
                : "text-text-secondary"
            )}
          >
            {message}
          </p>
        )}
        {detail && <p className="text-xs text-text-secondary">{detail}</p>}

        <Button
          type="button"
          onClick={() => void ingest()}
          disabled={loading || !file || !klantOk}
          className="w-full rounded-2xl"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Indexeren…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Upload &amp; indexeer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
