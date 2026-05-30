"use client";

import { useCallback, useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  Play,
  Settings2,
  X,
} from "lucide-react";
import type { CompanyId } from "@/lib/types";
import type {
  ContentStudioGridItem,
  ContentStudioSettings,
} from "@/lib/photo-studio/types";
import { ContentStudioMediaToggle } from "@/components/photo-studio/content-studio-media-toggle";
import { ContentStudioModelPicker } from "@/components/photo-studio/content-studio-model-picker";
import { ContentStudioSettingsPopover } from "@/components/photo-studio/content-studio-settings-popover";

export const DEFAULT_STUDIO_SETTINGS: ContentStudioSettings = {
  aspect_ratio: "1:1",
  quality: "2K",
  count: 1,
  auto_variants: true,
  model: "nano-banana-2",
};

type Props = {
  klant: CompanyId;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onGenerated: (items: ContentStudioGridItem[]) => void;
  onSkeletonCount: (count: number) => void;
  onError: (message: string) => void;
};

export function ContentStudioPromptBar({
  klant,
  busy,
  onBusyChange,
  onGenerated,
  onSkeletonCount,
  onError,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<ContentStudioSettings>(
    DEFAULT_STUDIO_SETTINGS
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patchSettings = (patch: Partial<ContentStudioSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  };

  const uploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      onError("");
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
        setImagePreview(data.media_url);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Upload mislukt");
      } finally {
        setUploading(false);
      }
    },
    [klant, onError]
  );

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      onError("Typ een prompt om te genereren.");
      return;
    }

    onBusyChange(true);
    onError("");
    onSkeletonCount(settings.count);

    try {
      const res = await fetch("/api/photo-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          prompt: trimmed,
          model: settings.model,
          image_urls: imageUrl ? [imageUrl] : [],
          aspect_ratio: settings.aspect_ratio,
          quality: settings.quality,
          count: settings.count,
          auto_variants: settings.auto_variants,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        items?: Array<{
          tracking_id: string;
          master_url: string;
          content_id: number | null;
          generation_id: number;
          variants: ContentStudioGridItem["variants"];
        }>;
        user_prompt?: string;
      };
      if (!res.ok) throw new Error(data.error || "Generatie mislukt");

      const rawItems = Array.isArray(data.items) ? data.items : [];
      if (!rawItems.length) throw new Error("Geen afbeelding ontvangen");

      const gridItems: ContentStudioGridItem[] = rawItems.map((item) => ({
        id: item.generation_id,
        tracking_id: item.tracking_id,
        user_prompt: data.user_prompt ?? trimmed,
        master_url: item.master_url,
        content_id: item.content_id,
        created_at: new Date().toISOString(),
        variants: item.variants ?? [],
      }));

      onGenerated(gridItems);
      onSkeletonCount(0);
    } catch (e) {
      onSkeletonCount(0);
      onError(e instanceof Error ? e.message : "Generatie mislukt");
    } finally {
      onBusyChange(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy) void generate();
    }
  };

  return (
    <footer className="content-studio-prompt-bar shrink-0 border-t border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-6">
      <div className="content-studio-prompt-shell rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-3 shadow-[var(--fumero-shadow-sm)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <ContentStudioMediaToggle />

          <div className="min-w-0 flex-1 space-y-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Beschrijf wat je wilt maken…"
              rows={1}
              className="content-studio-prompt-input fumero-text-body-sm w-full resize-none rounded-xl border-0 bg-transparent px-1 py-2 text-[var(--fumero-text)] outline-none placeholder:text-[var(--fumero-text-muted)]"
              style={{ minHeight: 44, maxHeight: 120 }}
              disabled={busy}
            />

            <div className="flex flex-wrap items-center gap-2">
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
              {imagePreview ? (
                <span className="content-studio-ref-chip inline-flex items-center gap-1.5 rounded-full border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] py-0.5 pl-0.5 pr-2 fumero-text-body-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Referentie"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="text-[var(--fumero-text-muted)]">Referentie</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface)]"
                    onClick={() => {
                      setImageUrl("");
                      setImagePreview(null);
                    }}
                    aria-label="Referentie verwijderen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="content-studio-ref-add inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--fumero-border)] px-2.5 py-1 fumero-text-body-sm text-[var(--fumero-text-muted)] transition-colors hover:border-[rgba(105,196,0,0.35)] hover:text-[var(--fumero-text)]"
                  disabled={uploading || busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Image Reference
                </button>
              )}

              <ContentStudioModelPicker
                value={settings.model}
                onChange={(model) => patchSettings({ model })}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end">
            <ContentStudioSettingsPopover
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              settings={settings}
              onChange={patchSettings}
              trigger={
                <button
                  type="button"
                  className="content-studio-icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--fumero-border)] text-[var(--fumero-text-muted)] transition-colors hover:bg-[var(--fumero-surface-muted)] hover:text-[var(--fumero-text)]"
                  aria-label="Instellingen"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              }
            />

            <button
              type="button"
              className="content-studio-generate-btn inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--fumero-accent)] px-4 fumero-text-body-sm font-semibold text-white transition-colors hover:bg-[var(--fumero-accent-hover)] disabled:opacity-60"
              disabled={busy}
              onClick={() => void generate()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              <span className="hidden sm:inline">Genereren</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
