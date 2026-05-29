"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CompanyId } from "@/lib/types";
import type { GeneratedOutput } from "@/components/photo-studio/photo-studio-output";
import type { PhotoStudioMode } from "@/lib/photo-studio/types";
import { usePhotoStudioPresets } from "@/hooks/usePhotoStudioPresets";

type Props = {
  klant: CompanyId;
  onGenerated?: (payload: GeneratedOutput) => void;
};

export function PhotoStudioGenerator({ klant, onGenerated }: Props) {
  const presets = usePhotoStudioPresets();
  const [mode, setMode] = useState<PhotoStudioMode>("text_to_image");
  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState(presets.active_preset_id);
  const activePreset =
    presets.presets.find((p) => p.id === presetId) ?? presets.presets[0];
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("klant", klant);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json()) as {
          media_url?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Upload mislukt");
        if (!data.media_url) throw new Error("Geen media_url na upload");
        setImageUrl(data.media_url);
        setPreview(data.media_url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload mislukt");
      } finally {
        setUploading(false);
      }
    },
    [klant]
  );

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/photo-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          mode,
          prompt:
            mode === "text_to_image"
              ? prompt || activePreset.default_prompt
              : prompt || "Zelfde product, betere professionele foto.",
          image_url: mode === "image_to_image" ? imageUrl : undefined,
          style_hint: activePreset.style_hint,
          workspace_preset: activePreset.id,
        }),
      });
      const data = (await res.json()) as GeneratedOutput & {
        error?: string;
        prompt?: string;
      };
      if (!res.ok) throw new Error(data.error || "Generatie mislukt");
      if (!data.master_url) throw new Error("Geen afbeelding ontvangen");
      setPreview(data.master_url);
      onGenerated?.({
        tracking_id: data.tracking_id,
        master_url: data.master_url,
        content_id: data.content_id ?? null,
        variants: data.variants ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generatie mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-[#737373]">
          Workspace preset
        </label>
        <select
          className="h-9 w-full rounded-lg border border-[#E5E5E5] px-2 text-sm"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
        >
          {presets.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("text_to_image")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "text_to_image"
              ? "bg-[#69C400] text-white"
              : "bg-[#F5F5F5] text-[#525252] hover:bg-[#EBEBEB]"
          }`}
        >
          Tekst → beeld
        </button>
        <button
          type="button"
          onClick={() => setMode("image_to_image")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "image_to_image"
              ? "bg-[#69C400] text-white"
              : "bg-[#F5F5F5] text-[#525252] hover:bg-[#EBEBEB]"
          }`}
        >
          Beeld → beeld
        </button>
      </div>

      {mode === "image_to_image" ? (
        <div className="mb-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Productfoto uploaden
          </Button>
          {imageUrl ? (
            <p className="mt-2 text-xs text-[#737373]">Bron geladen — zelfde product, betere foto.</p>
          ) : null}
        </div>
      ) : null}

      <label className="mb-1 block text-xs font-medium text-[#737373]">
        {mode === "text_to_image" ? "Prompt" : "Extra instructie (optioneel)"}
      </label>
      <Input
        className="mb-4 border-[#E5E5E5]"
        placeholder={
          mode === "text_to_image"
            ? "Bijv. premium ginfles op marmeren ondergrond…"
            : "Optioneel: warmere belichting, lifestyle setting…"
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full gap-2 bg-[#69C400] hover:bg-[#5ab300]"
        disabled={busy || (mode === "image_to_image" && !imageUrl)}
        onClick={() => void generate()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "text_to_image" ? (
          <Sparkles className="h-4 w-4" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
        Genereren
      </Button>

      {preview ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E5E5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="max-h-80 w-full object-contain bg-[#FAFAFA]" />
        </div>
      ) : null}
    </div>
  );
}
