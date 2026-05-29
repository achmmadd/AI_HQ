"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, UtensilsCrossed, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CompanyId } from "@/lib/types";

type Props = {
  klant: CompanyId;
  onDone?: () => void;
};

export function PhotoStudioMenuBatch({ klant, onDone }: Props) {
  const [styling, setStyling] = useState(
    "warm ambient light, consistent plate styling, appetizing Dutch restaurant menu look"
  );
  const [extra, setExtra] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<
    Array<{ index: number; master_url?: string; error?: string }>
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);
      setError("");
      const added: string[] = [];
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.set("file", file);
          fd.set("klant", klant);
          const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
          const data = (await res.json()) as { media_url?: string; error?: string };
          if (!res.ok || !data.media_url) throw new Error(data.error || "Upload mislukt");
          added.push(data.media_url);
        }
        setUrls((prev) => [...prev, ...added]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload mislukt");
      } finally {
        setUploading(false);
      }
    },
    [klant]
  );

  const runBatch = async () => {
    setBusy(true);
    setError("");
    setItems([]);
    try {
      const res = await fetch("/api/photo-studio/menu-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          image_urls: urls,
          styling_params: styling,
          extra_prompt: extra,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        items?: Array<{ index: number; master_url?: string; error?: string }>;
      };
      if (!res.ok) throw new Error(data.error || "Batch mislukt");
      setItems(data.items ?? []);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UtensilsCrossed className="h-4 w-4 text-[#69C400]" />
        Menu-batch (Bokas)
      </h2>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="mb-3 w-full gap-2"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Gerechten uploaden ({urls.length})
      </Button>
      <Input
        className="mb-2 border-[#E5E5E5]"
        placeholder="Vaste styling / belichting"
        value={styling}
        onChange={(e) => setStyling(e.target.value)}
      />
      <Input
        className="mb-3 border-[#E5E5E5]"
        placeholder="Extra instructie (optioneel)"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
      />
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      <Button
        type="button"
        className="w-full bg-[#69C400] hover:bg-[#5ab300]"
        disabled={busy || !urls.length}
        onClick={() => void runBatch()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Verwerk batch naar bibliotheek
      </Button>
      {items.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {items.map((it) => (
            <li key={it.index} className="rounded border p-2 text-xs">
              {it.master_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={it.master_url} alt="" className="mb-1 aspect-square w-full object-cover" />
              ) : (
                <p className="text-red-700">{it.error}</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
