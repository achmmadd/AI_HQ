"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  Calendar,
  Copy,
  Download,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  composePromptFromBlocks,
  varyPromptBlocks,
  VARIATION_MODES,
} from "@/lib/photo-studio/compose-template-prompt";
import {
  BLOCK_DROPDOWN_OPTIONS,
  CONTENT_STUDIO_PLATFORMS,
  DEFAULT_PROMPT_BLOCKS,
  PROMPT_BLOCK_LABELS,
} from "@/lib/photo-studio/starter-templates";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import type { CompanyId } from "@/lib/types";
import type {
  ContentStudioAspectRatio,
  ContentStudioGridItem,
  ContentStudioPlatform,
  ContentStudioQuality,
  PromptBlockKey,
  PromptBlocks,
  PromptVariationMode,
  StarterTemplate,
} from "@/lib/photo-studio/types";
import { normalizeQualityForModel } from "@/lib/photo-studio/types";

const VARIANT_LABELS: Record<string, string> = {
  ig_1_1: "Instagram 1:1",
  stories_9_16: "Stories 9:16",
  pinterest_2_3: "Pinterest 2:3",
  hero_16_9: "Hero 16:9",
};

const ASPECTS: ContentStudioAspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
];

const QUALITIES: ContentStudioQuality[] = ["2K", "3K", "4K"];

type DrawerTab = "details" | "template";

export type ContentStudioDrawerDraft = {
  tab?: DrawerTab;
  blocks?: PromptBlocks;
  platform?: ContentStudioPlatform;
  aspect_ratio?: ContentStudioAspectRatio;
  quality?: ContentStudioQuality;
  title?: string;
  category?: string;
};

type VariationCandidate = ContentStudioGridItem & { variationMode: PromptVariationMode };

type Props = {
  klant: CompanyId;
  item: ContentStudioGridItem | null;
  draft?: ContentStudioDrawerDraft | null;
  onClose: () => void;
  onScheduled?: () => void;
  onGenerated?: (items: ContentStudioGridItem[]) => void;
};

function blocksFromPrompt(userPrompt: string): PromptBlocks {
  return {
    ...DEFAULT_PROMPT_BLOCKS,
    subject: userPrompt.trim() || DEFAULT_PROMPT_BLOCKS.subject,
  };
}

function BlockField({
  blockKey,
  value,
  onChange,
}: {
  blockKey: PromptBlockKey;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = BLOCK_DROPDOWN_OPTIONS[blockKey];
  const isPreset = options.includes(value);
  const selectValue = isPreset ? value : "__custom__";

  return (
    <div className="space-y-1">
      <label
        htmlFor={`block-${blockKey}`}
        className="fumero-text-caption text-[var(--fumero-text-muted)]"
      >
        {PROMPT_BLOCK_LABELS[blockKey]}
      </label>
      <select
        id={`block-${blockKey}`}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next === "__custom__" ? "" : next);
        }}
        className="fumero-text-body-sm w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-2 text-[var(--fumero-text)] outline-none focus:border-[rgba(105,196,0,0.45)]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__custom__">Aangepast…</option>
      </select>
      {selectValue === "__custom__" ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Eigen ${PROMPT_BLOCK_LABELS[blockKey].toLowerCase()}…`}
          className="fumero-text-body-sm w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-2 text-[var(--fumero-text)] outline-none focus:border-[rgba(105,196,0,0.45)]"
        />
      ) : null}
    </div>
  );
}

export function ContentStudioTileDrawer({
  klant,
  item,
  draft,
  onClose,
  onScheduled,
  onGenerated,
}: Props) {
  const open = Boolean(item || draft);
  const [tab, setTab] = useState<DrawerTab>("details");
  const [blocks, setBlocks] = useState<PromptBlocks>(DEFAULT_PROMPT_BLOCKS);
  const [platform, setPlatform] = useState<ContentStudioPlatform>("Website");
  const [aspectRatio, setAspectRatio] = useState<ContentStudioAspectRatio>("1:1");
  const [quality, setQuality] = useState<ContentStudioQuality>("2K");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Product");
  const [generating, setGenerating] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [variations, setVariations] = useState<VariationCandidate[]>([]);
  const [variationsBusy, setVariationsBusy] = useState(false);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab(draft?.tab ?? (item ? "details" : "template"));
    setBlocks(
      draft?.blocks ??
        (item ? blocksFromPrompt(item.user_prompt) : DEFAULT_PROMPT_BLOCKS)
    );
    setPlatform(draft?.platform ?? "Website");
    setAspectRatio(draft?.aspect_ratio ?? "1:1");
    setQuality(
      normalizeQualityForModel("nano-banana-2", draft?.quality ?? "2K")
    );
    setTitle(draft?.title ?? "");
    setCategory(draft?.category ?? "Product");
    setVariations([]);
    setGenerateError("");
  }, [open, item, draft]);

  const composedPrompt = useMemo(
    () => composePromptFromBlocks(blocks, platform),
    [blocks, platform]
  );

  const patchBlock = useCallback((key: PromptBlockKey, value: string) => {
    setBlocks((prev) => ({ ...prev, [key]: value }));
  }, []);

  const schedule = async () => {
    if (!item?.content_id) return;
    const when = window.prompt(
      "Inplannen op (YYYY-MM-DD HH:MM, leeg = morgen 10:00):",
      ""
    );
    const res = await fetch("/api/photo-studio/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        klant,
        content_id: item.content_id,
        datetime: when?.trim() || undefined,
        platform: "instagram",
      }),
    });
    const data = (await res.json()) as { error?: string; scheduled_at?: string };
    if (!res.ok) {
      alert(data.error || "Inplannen mislukt");
      return;
    }
    alert(`Ingepland: ${data.scheduled_at ?? "ok"}`);
    onScheduled?.();
  };

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const generateVariation = async () => {
    const prompt = composedPrompt.trim();
    if (!prompt) {
      setGenerateError("Vul minimaal één blok in.");
      return;
    }

    setGenerating(true);
    setGenerateError("");
    try {
      const normalizedQuality = normalizeQualityForModel(
        "nano-banana-2",
        quality
      );
      const data = await fetchJsonChecked<{
        error?: string;
        items?: Array<{
          tracking_id: string;
          master_url: string;
          content_id: number | null;
          generation_id: number;
          variants: ContentStudioGridItem["variants"];
        }>;
        user_prompt?: string;
      }>("/api/photo-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          prompt,
          model: "nano-banana-2",
          aspect_ratio: aspectRatio,
          quality: normalizedQuality,
          count: 1,
          auto_variants: true,
        }),
      });

      const rawItems = Array.isArray(data.items) ? data.items : [];
      if (!rawItems.length) throw new Error("Geen afbeelding ontvangen");

      const gridItems: ContentStudioGridItem[] = rawItems.map((row) => ({
        id: row.generation_id,
        tracking_id: row.tracking_id,
        user_prompt: data.user_prompt ?? prompt,
        master_url: row.master_url,
        media_type: "image",
        content_id: row.content_id,
        created_at: new Date().toISOString(),
        variants: row.variants ?? [],
      }));

      onGenerated?.(gridItems);
    } catch (e) {
      setGenerateError(
        e instanceof Error ? e.message : "Generatie mislukt"
      );
    } finally {
      setGenerating(false);
    }
  };

  const saveAsRecipe = async () => {
    const name = window.prompt("Naam voor dit recept:", title || "Mijn recept");
    if (!name?.trim()) return;

    setSavingRecipe(true);
    try {
      await fetchJsonChecked("/api/photo-studio/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          title: name.trim(),
          category,
          platform,
          blocks,
          aspect_ratio: aspectRatio,
          quality: normalizeQualityForModel("nano-banana-2", quality),
          thumbnail_url: item?.master_url ?? null,
          is_recipe: true,
        }),
      });
      alert(`Recept "${name.trim()}" opgeslagen.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSavingRecipe(false);
    }
  };

  const makeThreeVariations = async () => {
    if (!item) return;
    setVariationsBusy(true);
    setGenerateError("");
    setVariations([]);

    try {
      const baseBlocks = blocksFromPrompt(item.user_prompt);
      const normalizedQuality = normalizeQualityForModel("nano-banana-2", "2K");
      const results: VariationCandidate[] = [];

      for (const mode of VARIATION_MODES) {
        const prompt = composePromptFromBlocks(
          varyPromptBlocks(baseBlocks, mode)
        );
        const res = await fetchJsonChecked<{
          items?: Array<{
            tracking_id: string;
            master_url: string;
            content_id: number | null;
            generation_id: number;
            variants: ContentStudioGridItem["variants"];
          }>;
          user_prompt?: string;
        }>("/api/photo-studio/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            klant,
            prompt,
            model: "nano-banana-2",
            aspect_ratio: aspectRatio,
            quality: normalizedQuality,
            count: 1,
            auto_variants: true,
          }),
        });
        const row = res.items?.[0];
        if (row) {
          results.push({
            id: row.generation_id,
            tracking_id: row.tracking_id,
            user_prompt: res.user_prompt ?? prompt,
            master_url: row.master_url,
            media_type: "image",
            content_id: row.content_id,
            created_at: new Date().toISOString(),
            variants: row.variants ?? [],
            variationMode: mode,
          });
        }
      }

      if (!results.length) throw new Error("Geen variaties ontvangen");
      setVariations(results);
    } catch (e) {
      setGenerateError(
        e instanceof Error ? e.message : "Variaties genereren mislukt"
      );
    } finally {
      setVariationsBusy(false);
    }
  };

  const chooseVariation = (chosen: VariationCandidate) => {
    onGenerated?.([chosen]);
    setVariations([]);
    onClose();
  };

  if (!open) return null;

  const formattedDate = item?.created_at
    ? new Date(item.created_at).toLocaleString("nl-NL")
    : "—";

  const variationModeLabel: Record<PromptVariationMode, string> = {
    exact: "Exact",
    light: "Lichte variatie",
    bold: "Grove variatie",
  };

  return (
    <>
      <button
        type="button"
        className="content-studio-drawer-backdrop fixed inset-0 z-50 bg-black/40 transition-opacity duration-200"
        aria-label="Sluiten"
        onClick={onClose}
      />
      <aside
        className="content-studio-drawer fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--fumero-border)] bg-[var(--fumero-surface)] shadow-[var(--fumero-shadow-md)]"
        role="dialog"
        aria-label={item ? "Beelddetails" : "Template bewerken"}
      >
        <header className="flex shrink-0 flex-col gap-2 border-b border-[var(--fumero-border)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-[var(--fumero-surface-muted)] p-1">
              {item ? (
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 fumero-text-body-sm font-medium transition-colors ${
                    tab === "details"
                      ? "bg-[var(--fumero-surface)] text-[var(--fumero-text)] shadow-[var(--fumero-shadow-sm)]"
                      : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
                  }`}
                  onClick={() => setTab("details")}
                >
                  Details
                </button>
              ) : null}
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 fumero-text-body-sm font-medium transition-colors ${
                  tab === "template"
                    ? "bg-[var(--fumero-surface)] text-[var(--fumero-text)] shadow-[var(--fumero-shadow-sm)]"
                    : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
                }`}
                onClick={() => setTab("template")}
              >
                Template
              </button>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
              onClick={onClose}
              aria-label="Sluiten"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {title && tab === "template" ? (
            <p className="fumero-text-body-sm text-[var(--fumero-text)]">
              {title}
              {category ? (
                <span className="ml-2 rounded-full bg-[var(--fumero-surface-muted)] px-2 py-0.5 fumero-text-caption text-[var(--fumero-text-muted)]">
                  {category}
                </span>
              ) : null}
            </p>
          ) : null}
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "details" && item ? (
            <>
              <div className="mb-4 overflow-hidden rounded-xl bg-[var(--fumero-surface-muted)]">
                {item.media_type === "video" ? (
                  <video
                    src={item.master_url}
                    className="w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.master_url}
                    alt={item.user_prompt.slice(0, 80)}
                    className="w-full object-contain"
                  />
                )}
              </div>

              {variations.length > 0 ? (
                <div className="mb-4">
                  <h3 className="fumero-text-body-sm mb-2 font-medium text-[var(--fumero-text)]">
                    Variaties — kies de beste
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {variations.map((v) => (
                      <div
                        key={v.tracking_id}
                        className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--fumero-surface-muted)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.master_url}
                          alt={variationModeLabel[v.variationMode]}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="mb-1 fumero-text-caption text-white/80">
                            {variationModeLabel[v.variationMode]}
                          </span>
                          <button
                            type="button"
                            className="w-full rounded-md bg-[var(--fumero-accent)] px-2 py-1 fumero-text-caption font-medium text-white hover:bg-[var(--fumero-accent-hover)]"
                            onClick={() => chooseVariation(v)}
                          >
                            Kies deze
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <dl className="mb-4 space-y-2">
                <div>
                  <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                    Type
                  </dt>
                  <dd className="fumero-text-body-sm mt-0.5 text-[var(--fumero-text)]">
                    {item.media_type === "video" ? "Video" : "Beeld"}
                  </dd>
                </div>
                <div>
                  <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                    Prompt
                  </dt>
                  <dd className="fumero-text-body-sm mt-0.5 text-[var(--fumero-text)]">
                    {item.user_prompt}
                  </dd>
                </div>
                <div>
                  <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                    ID
                  </dt>
                  <dd className="fumero-text-body-sm mt-0.5 font-mono text-[var(--fumero-text-muted)]">
                    {item.tracking_id}
                  </dd>
                </div>
                <div>
                  <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                    Aangemaakt
                  </dt>
                  <dd className="fumero-text-body-sm mt-0.5 text-[var(--fumero-text)]">
                    {formattedDate}
                  </dd>
                </div>
              </dl>

              {item.media_type === "image" ? (
                <button
                  type="button"
                  className="mb-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)] disabled:opacity-60"
                  disabled={variationsBusy}
                  onClick={() => void makeThreeVariations()}
                >
                  {variationsBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Maak 3 variaties
                </button>
              ) : null}

              {item.variants.length > 0 ? (
                <div className="mb-4">
                  <h3 className="fumero-text-body-sm mb-2 font-medium text-[var(--fumero-text)]">
                    Social formaten
                  </h3>
                  <ul className="space-y-2">
                    {item.variants.map((v) => (
                      <li
                        key={v.public_url}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[var(--fumero-border)] px-3 py-2"
                      >
                        <span className="fumero-text-body-sm text-[var(--fumero-text)]">
                          {VARIANT_LABELS[v.aspect] ?? v.aspect}
                          <span className="ml-1 text-[var(--fumero-text-muted)]">
                            {v.width}×{v.height}
                          </span>
                        </span>
                        <a
                          href={v.public_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--fumero-border)] px-2 fumero-text-caption text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              {item ? (
                <div className="overflow-hidden rounded-xl bg-[var(--fumero-surface-muted)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.master_url}
                    alt=""
                    className="h-20 w-full object-cover"
                  />
                </div>
              ) : null}

              {(Object.keys(PROMPT_BLOCK_LABELS) as PromptBlockKey[]).map(
                (key) => (
                  <BlockField
                    key={key}
                    blockKey={key}
                    value={blocks[key]}
                    onChange={(v) => patchBlock(key, v)}
                  />
                )
              )}

              <div>
                <p className="fumero-text-caption mb-1.5 text-[var(--fumero-text-muted)]">
                  Live preview
                </p>
                <div className="rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2">
                  <p className="fumero-text-body-sm whitespace-pre-wrap text-[var(--fumero-text-muted)]">
                    {composedPrompt || "Vul blokken in om een prompt te zien…"}
                  </p>
                </div>
                <p className="mt-1.5 fumero-text-caption text-[var(--fumero-text-muted)]">
                  De server voegt automatisch studio-enrichment toe via fal.ts
                  (product/food context) — niet zichtbaar in de UI.
                </p>
              </div>

              <div>
                <p className="fumero-text-caption mb-1.5 text-[var(--fumero-text-muted)]">
                  Platform
                </p>
                <div className="flex flex-wrap gap-1">
                  {CONTENT_STUDIO_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`fumero-text-body-sm rounded-md px-2.5 py-1 font-medium transition-colors ${
                        platform === p
                          ? "content-studio-settings-chip--active"
                          : "text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
                      }`}
                      onClick={() => setPlatform(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="fumero-text-caption mb-1.5 text-[var(--fumero-text-muted)]">
                  Beeldverhouding
                </p>
                <div className="flex flex-wrap gap-1">
                  {ASPECTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`fumero-text-body-sm rounded-md px-2.5 py-1 font-medium transition-colors ${
                        aspectRatio === a
                          ? "content-studio-settings-chip--active"
                          : "text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
                      }`}
                      onClick={() => setAspectRatio(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="fumero-text-caption mb-1.5 text-[var(--fumero-text-muted)]">
                  Kwaliteit
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUALITIES.filter((q) => q !== "3K").map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`fumero-text-body-sm rounded-md px-2.5 py-1 font-medium transition-colors ${
                        quality === q
                          ? "content-studio-settings-chip--active"
                          : "text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
                      }`}
                      onClick={() => setQuality(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {generateError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 fumero-text-caption text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  {generateError}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--fumero-border)] p-4">
          {tab === "template" ? (
            <>
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--fumero-accent)] fumero-text-body-sm font-semibold text-white hover:bg-[var(--fumero-accent-hover)] disabled:opacity-60"
                disabled={generating || !composedPrompt.trim()}
                onClick={() => void generateVariation()}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Genereer variatie
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)] disabled:opacity-60"
                disabled={savingRecipe || !composedPrompt.trim()}
                onClick={() => void saveAsRecipe()}
              >
                {savingRecipe ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-4 w-4" />
                )}
                Sla op als recept
              </button>
            </>
          ) : item ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={item.master_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
              >
                <Download className="h-4 w-4" />
                Master
              </a>
              {item.content_id ? (
                <button
                  type="button"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                  onClick={() => void schedule()}
                >
                  <Calendar className="h-4 w-4" />
                  Inplannen
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                onClick={() => void copyPrompt(item.user_prompt)}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                onClick={() => setTab("template")}
              >
                Template bewerken
              </button>
            </div>
          ) : null}
        </footer>
      </aside>
    </>
  );
}

export function starterToDrawerDraft(template: StarterTemplate): ContentStudioDrawerDraft {
  return {
    tab: "template",
    blocks: { ...template.blocks },
    platform: template.platform,
    aspect_ratio: template.aspect_ratio,
    quality: template.quality,
    title: template.title,
    category: template.category,
  };
}
