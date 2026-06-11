"use client";

import { useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import type { CompanyId } from "@/lib/types";

const DEFAULT_SLIDES = [
  { headline: "Intro" },
  { headline: "Voordeel 1" },
  { headline: "Voordeel 2" },
  { headline: "Voordeel 3" },
  { headline: "Call to action" },
];

type Props = {
  klant: CompanyId;
  onDone?: () => void;
};

export function PhotoStudioCarousel({ klant, onDone }: Props) {
  const [basePrompt, setBasePrompt] = useState("");
  const [backgroundLock, setBackgroundLock] = useState(
    "zelfde achtergrond en belichting voor alle slides"
  );
  const [slides, setSlides] = useState(DEFAULT_SLIDES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    seed: number;
    slides: Array<{ slide_index: number; master_url: string; headline: string }>;
  } | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await fetchJsonChecked<{
        error?: string;
        seed?: number;
        slides?: Array<{ slide_index: number; master_url: string; headline: string }>;
        errors?: string[];
      }>("/api/photo-studio/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          base_prompt: basePrompt,
          background_lock: backgroundLock,
          slides,
        }),
      });
      if (data.errors?.length) setError(data.errors.join("; "));
      setResult({ seed: data.seed ?? 0, slides: data.slides ?? [] });
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Carousel mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Layers className="h-4 w-4 text-[#69C400]" />
        Carousel (5 slides)
      </h2>
      <Input
        className="mb-2 border-[var(--fumero-border)]"
        placeholder="Basis product / campagne prompt"
        value={basePrompt}
        onChange={(e) => setBasePrompt(e.target.value)}
      />
      <Input
        className="mb-3 border-[var(--fumero-border)]"
        placeholder="Vaste achtergrond / seed lock beschrijving"
        value={backgroundLock}
        onChange={(e) => setBackgroundLock(e.target.value)}
      />
      <div className="mb-3 space-y-2">
        {slides.map((s, i) => (
          <Input
            key={i}
            className="border-[var(--fumero-border)] text-sm"
            placeholder={`Slide ${i + 1} tekst`}
            value={s.headline}
            onChange={(e) => {
              const next = [...slides];
              next[i] = { ...next[i], headline: e.target.value };
              setSlides(next);
            }}
          />
        ))}
      </div>
      {error ? (
        <p className="mb-2 text-sm text-red-700">{error}</p>
      ) : null}
      <Button
        type="button"
        className="w-full gap-2 bg-[#69C400] hover:bg-[#5ab300]"
        disabled={busy || !basePrompt.trim()}
        onClick={() => void run()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Genereer carousel
      </Button>
      {result ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {result.slides.map((s) => (
            <a key={s.slide_index} href={s.master_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.master_url}
                alt={s.headline}
                className="aspect-square w-full rounded border object-cover"
              />
              <p className="mt-1 truncate text-[10px]">{s.headline}</p>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
