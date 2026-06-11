"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_STUDIO_SETTINGS } from "@/components/photo-studio/content-studio-prompt-bar";
import { useGenerationProgress } from "@/hooks/use-generation-progress";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import {
  MAX_REF_IMAGES,
  normalizeQualityForModel,
  type ContentStudioGridItem,
  type ContentStudioMediaType,
  type ContentStudioSettings,
  type ContentStudioSkeletonMode,
  type StarterTemplate,
} from "@/lib/photo-studio/types";
import { resolveEffectivePrompt } from "@/lib/fumero/worldclass-studio/prompt-submit";
import type { CompanyId } from "@/lib/types";

export type RefImage = { url: string; preview: string };

export function usePhotoStudioGeneration(klant: CompanyId) {
  const [items, setItems] = useState<ContentStudioGridItem[]>([]);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [skeletonMode, setSkeletonMode] =
    useState<ContentStudioSkeletonMode>("generate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [mediaType, setMediaType] = useState<ContentStudioMediaType>("image");
  const [settings, setSettings] = useState<ContentStudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [refs, setRefs] = useState<RefImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refsRef = useRef<RefImage[]>([]);
  const [creditsLabel, setCreditsLabel] = useState("Onbeperkt ∞");
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [startFrame, setStartFrame] = useState<RefImage | null>(null);
  const [endFrame, setEndFrame] = useState<RefImage | null>(null);
  const frameFileRef = useRef<HTMLInputElement>(null);
  const [pendingFrameTarget, setPendingFrameTarget] = useState<"start" | "end" | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const genProgress = useGenerationProgress(mediaType === "video" ? 18_000 : 10_000);

  const loadLibrary = useCallback(async () => {
    try {
      const data = await fetchJsonChecked<{
        items?: Array<
          ContentStudioGridItem & {
            prompt?: string;
            media_type?: ContentStudioGridItem["media_type"];
          }
        >;
      }>(`/api/photo-studio/library?klant=${klant}`, { credentials: "include" });
      if (Array.isArray(data.items)) {
        setItems(
          data.items.map((i) => ({
            id: i.id,
            tracking_id: i.tracking_id,
            user_prompt: i.user_prompt ?? i.prompt ?? "",
            master_url: i.master_url,
            media_type: i.media_type ?? "image",
            content_id: i.content_id,
            created_at: i.created_at,
            variants: i.variants ?? [],
          }))
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Bibliotheek laden mislukt — vernieuw de pagina."
      );
    }
  }, [klant]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLibrary();
  }, [loadLibrary, refreshKey]);

  const onSkeletonCount = useCallback(
    (count: number, mode: ContentStudioSkeletonMode = "generate") => {
      setSkeletonCount(count);
      if (count > 0) setSkeletonMode(mode);
    },
    []
  );

  const onGenerated = useCallback((newItems: ContentStudioGridItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    setRefreshKey((n) => n + 1);
  }, []);

  const patchSettings = useCallback((patch: Partial<ContentStudioSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.model) {
        next.quality = normalizeQualityForModel(patch.model, next.quality);
      }
      return next;
    });
  }, []);

  const applyStarter = useCallback((t: StarterTemplate) => {
    const desc = `${t.title}: ${t.blocks.subject}, ${t.blocks.style}, ${t.blocks.lighting}, ${t.blocks.composition} — ${t.blocks.mood}`;
    setPrompt(desc);
    patchSettings({ aspect_ratio: t.aspect_ratio });
  }, [patchSettings]);

  const revokePreview = useCallback((preview: string) => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, []);

  useEffect(() => {
    return () => {
      refsRef.current.forEach((r) => {
        if (r.preview.startsWith("blob:")) URL.revokeObjectURL(r.preview);
      });
    };
  }, []);

  useEffect(() => {
    refsRef.current = refs;
  }, [refs]);

  const maxRefs = mediaType === "video" ? 1 : MAX_REF_IMAGES[settings.model];
  const skeletonSlots = mediaType === "video" ? 1 : settings.count;
  const currentSkeletonMode: ContentStudioSkeletonMode =
    refs.length > 0 && mediaType === "image" ? "edit" : "generate";
  const isVideo = mediaType === "video";
  const isEdit = !isVideo && refs.length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefs((prev) => prev.slice(0, maxRefs));
  }, [maxRefs]);

  useEffect(() => {
    if (isVideo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefs((prev) => prev.slice(0, 1));
    }
  }, [isVideo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreditsLoading(true);
    fetch(`/api/billing/summary?klant=${klant}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const b = j.budget || {};
        let label = "Onbeperkt ∞";
        if (typeof b.credits_remaining === "number") label = `${b.credits_remaining} resterend`;
        else if (typeof b.remaining === "number") label = `${b.remaining} credits`;
        else if (j.note && String(j.note).toLowerCase().includes("unlimited")) label = "Onbeperkt ∞";
        setCreditsLabel(label);
      })
      .catch(() => setCreditsLabel("Onbeperkt ∞"))
      .finally(() => setCreditsLoading(false));
  }, [klant]);

  const uploadImages = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      setError("");
      const uploaded: RefImage[] = [];
      try {
        for (const file of files) {
          if (refs.length + uploaded.length >= maxRefs) break;
          const fd = new FormData();
          fd.set("file", file);
          fd.set("klant", klant);
          const data = await fetchJsonChecked<{ media_url?: string; error?: string }>(
            "/api/upload",
            { method: "POST", body: fd, credentials: "include" }
          );
          if (!data.media_url) throw new Error(data.error || "Upload mislukt");
          uploaded.push({ url: data.media_url, preview: URL.createObjectURL(file) });
        }
        if (uploaded.length) {
          setRefs((prev) => [...prev, ...uploaded].slice(0, maxRefs));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload mislukt");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [klant, maxRefs, refs.length]
  );

  const uploadFrameForTarget = useCallback(
    async (file: File, target: "start" | "end") => {
      setUploading(true);
      setError("");
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("klant", klant);
        const data = await fetchJsonChecked<{ media_url?: string; error?: string }>(
          "/api/upload",
          { method: "POST", body: fd, credentials: "include" }
        );
        if (!data.media_url) throw new Error(data.error || "Upload mislukt");
        const preview = URL.createObjectURL(file);
        const ref = { url: data.media_url, preview };
        if (target === "start") setStartFrame(ref);
        else setEndFrame(ref);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload mislukt");
      } finally {
        setUploading(false);
        if (frameFileRef.current) frameFileRef.current.value = "";
      }
    },
    [klant]
  );

  const cancelGenerate = useCallback(() => {
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setBusy(false);
    genProgress.reset();
    onSkeletonCount(0);
    setError("");
  }, [genProgress, onSkeletonCount]);

  const generate = useCallback(async () => {
    const effectivePrompt = resolveEffectivePrompt(prompt, refs.length, mediaType);
    if (!effectivePrompt) {
      setError("Typ een prompt om te genereren.");
      return;
    }

    generateAbortRef.current?.abort();
    const ac = new AbortController();
    generateAbortRef.current = ac;
    genProgress.start();
    setBusy(true);
    setError("");
    onSkeletonCount(skeletonSlots, currentSkeletonMode);

    try {
      const data = await fetchJsonChecked<{
        error?: string;
        items?: Array<{
          tracking_id: string;
          master_url: string;
          content_id: number | null;
          generation_id: number;
          media_type?: ContentStudioMediaType;
          variants: ContentStudioGridItem["variants"];
        }>;
        user_prompt?: string;
      }>("/api/photo-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ac.signal,
        body: JSON.stringify({
          klant,
          prompt: effectivePrompt,
          media_type: mediaType,
          model: settings.model,
          image_urls: refs.map((r) => r.url),
          start_image_url: startFrame?.url,
          end_image_url: endFrame?.url,
          aspect_ratio: settings.aspect_ratio,
          quality: settings.quality,
          count: isVideo ? 1 : settings.count,
          auto_variants: isVideo ? false : settings.auto_variants,
          brand_enhancement: settings.brand_enhancement === true,
        }),
      });

      const rawItems = Array.isArray(data.items) ? data.items : [];
      if (!rawItems.length) throw new Error("Geen afbeelding ontvangen");

      const gridItems: ContentStudioGridItem[] = rawItems.map((item) => ({
        id: item.generation_id,
        tracking_id: item.tracking_id,
        user_prompt: data.user_prompt ?? effectivePrompt,
        master_url: item.master_url,
        media_type: item.media_type ?? mediaType,
        content_id: item.content_id,
        created_at: new Date().toISOString(),
        variants: item.variants ?? [],
      }));

      genProgress.complete();
      onGenerated(gridItems);
      onSkeletonCount(0);
      setPrompt("");
      if (mediaType === "video") {
        setStartFrame(null);
        setEndFrame(null);
      }
    } catch (e) {
      genProgress.reset();
      onSkeletonCount(0);
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Geannuleerd.");
        return;
      }
      setError(e instanceof Error ? e.message : "Generatie mislukt");
    } finally {
      if (generateAbortRef.current === ac) generateAbortRef.current = null;
      setBusy(false);
    }
  }, [
    prompt,
    refs,
    mediaType,
    klant,
    settings,
    startFrame,
    endFrame,
    isVideo,
    skeletonSlots,
    currentSkeletonMode,
    genProgress,
    onGenerated,
    onSkeletonCount,
  ]);

  const removeRef = useCallback(
    (index: number) => {
      setRefs((prev) => {
        const removed = prev[index];
        if (removed) revokePreview(removed.preview);
        return prev.filter((_, i) => i !== index);
      });
    },
    [revokePreview]
  );

  const refreshLibrary = useCallback(() => {
    setRefreshKey((n) => n + 1);
  }, []);

  return {
    items,
    skeletonCount,
    skeletonMode,
    busy,
    error,
    setError,
    prompt,
    setPrompt,
    mediaType,
    setMediaType,
    settings,
    patchSettings,
    refs,
    uploading,
    fileRef,
    frameFileRef,
    pendingFrameTarget,
    setPendingFrameTarget,
    creditsLabel,
    creditsLoading,
    startFrame,
    setStartFrame,
    endFrame,
    setEndFrame,
    maxRefs,
    isVideo,
    isEdit,
    genProgress,
    generate,
    cancelGenerate,
    uploadImages,
    uploadFrameForTarget,
    removeRef,
    applyStarter,
    onGenerated,
    refreshLibrary,
  };
}
