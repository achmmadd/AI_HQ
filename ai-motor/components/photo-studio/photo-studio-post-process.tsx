"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import type { CompanyId } from "@/lib/types";

type GenOption = { id: number; label: string };

type Props = {
  klant: CompanyId;
};

export function PhotoStudioPostProcess({ klant }: Props) {
  const [gens, setGens] = useState<GenOption[]>([]);
  const [genId, setGenId] = useState("");
  const [text, setText] = useState("");
  const [brightness, setBrightness] = useState("8");
  const [contrast, setContrast] = useState("5");
  const [logoUrl, setLogoUrl] = useState("");
  const [bgUrl, setBgUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoadError("");
      try {
        const data = await fetchJsonChecked<{
          items?: Array<{
            id: number;
            user_prompt?: string;
            prompt: string;
            tracking_id: string;
          }>;
        }>(`/api/photo-studio/library?klant=${klant}`, {
          credentials: "include",
        });
        if (data.items) {
          setGens(
            data.items.map((i) => ({
              id: i.id,
              label: `${i.tracking_id} — ${(i.user_prompt ?? i.prompt).slice(0, 40)}`,
            }))
          );
        }
      } catch (e) {
        setLoadError(
          e instanceof Error
            ? e.message
            : "Bibliotheek laden mislukt — vernieuw de pagina."
        );
      }
    })();
  }, [klant]);

  const run = async (op: Record<string, unknown>) => {
    const generation_id = Number(genId);
    if (!generation_id) {
      setMsg("Kies een generatie");
      return;
    }
    setMsg("");
    try {
      const data = await fetchJsonChecked<{ error?: string; public_url?: string }>(
        "/api/photo-studio/post-process",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ klant, generation_id, op }),
        }
      );
      setMsg(`Opgeslagen: ${data.public_url ?? "ok"}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Mislukt");
    }
  };

  const runBatch = async () => {
    const ids = gens.slice(0, 5).map((g) => g.id);
    if (!ids.length) return;
    setMsg("");
    try {
      const data = await fetchJsonChecked<{ error?: string; results?: unknown[] }>(
        "/api/photo-studio/post-process",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            klant,
            generation_ids: ids,
            op: {
              type: "batch_filter",
              filter: "brightness_contrast",
              brightness: Number(brightness) || 0,
              contrast: Number(contrast) || 0,
            },
          }),
        }
      );
      setMsg(`Batch: ${(data.results ?? []).length} bewerkt`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Mislukt");
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4" />
        Nabewerking (Sharp, geen AI)
      </h2>
      {loadError ? (
        <p className="mb-3 text-sm text-red-700">{loadError}</p>
      ) : null}
      <select
        className="mb-3 h-9 w-full rounded-lg border border-[#E5E5E5] px-2 text-sm"
        value={genId}
        onChange={(e) => setGenId(e.target.value)}
      >
        <option value="">Kies uit bibliotheek…</option>
        {gens.map((g) => (
          <option key={g.id} value={String(g.id)}>
            {g.label}
          </option>
        ))}
      </select>

      <div className="space-y-2">
        <Input
          placeholder="Tekst overlay"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border-[#E5E5E5]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void run({ type: "text_overlay", text: text || "Titel" })
          }
        >
          Tekst overlay
        </Button>

        <Input
          placeholder="Logo URL (/api/upload/...)"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="border-[#E5E5E5]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void run({ type: "logo_watermark", logo_url: logoUrl })
          }
        >
          Logo watermark
        </Button>

        <Input
          placeholder="Achtergrond URL"
          value={bgUrl}
          onChange={(e) => setBgUrl(e.target.value)}
          className="border-[#E5E5E5]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void run({ type: "background_swap", background_url: bgUrl })
          }
        >
          Achtergrond wisselen
        </Button>

        <div className="flex gap-2">
          <Input
            placeholder="Brightness %"
            value={brightness}
            onChange={(e) => setBrightness(e.target.value)}
            className="border-[#E5E5E5]"
          />
          <Input
            placeholder="Contrast %"
            value={contrast}
            onChange={(e) => setContrast(e.target.value)}
            className="border-[#E5E5E5]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void run({
              type: "brightness_contrast",
              brightness: Number(brightness),
              contrast: Number(contrast),
            })
          }
        >
          Helderheid / contrast
        </Button>

        <Button type="button" size="sm" onClick={() => void runBatch()}>
          Batch-filter (laatste 5 in bibliotheek)
        </Button>
      </div>

      {msg ? <p className="mt-3 text-xs text-[#525252]">{msg}</p> : null}
    </div>
  );
}
