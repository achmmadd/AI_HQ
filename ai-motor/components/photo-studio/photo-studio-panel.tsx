"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { ContentStudioOutputGrid } from "@/components/photo-studio/content-studio-output-grid";
import { ContentStudioPromptBar } from "@/components/photo-studio/content-studio-prompt-bar";
import { PhotoStudioCarousel } from "@/components/photo-studio/photo-studio-carousel";
import { PhotoStudioMenuBatch } from "@/components/photo-studio/photo-studio-menu-batch";
import { PhotoStudioPostProcess } from "@/components/photo-studio/photo-studio-post-process";
import type { ContentStudioDrawerDraft } from "@/components/photo-studio/content-studio-tile-drawer";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import type { CompanyId } from "@/lib/types";
import type {
  ContentStudioGridItem,
  ContentStudioSkeletonMode,
  ContentStudioTemplateRow,
} from "@/lib/photo-studio/types";

type MeerView = "carousel" | "menu" | "postprocess" | "recipes" | null;

type Props = {
  klant: CompanyId;
  title?: string;
  className?: string;
};

function recipeToDraft(recipe: ContentStudioTemplateRow): ContentStudioDrawerDraft {
  return {
    tab: "template",
    blocks: { ...recipe.blocks },
    platform: recipe.platform,
    aspect_ratio: recipe.aspect_ratio,
    quality: recipe.quality,
    title: recipe.title,
    category: recipe.category,
  };
}

export function PhotoStudioPanel({
  klant,
  title = "Content Studio",
  className = "",
}: Props) {
  const [items, setItems] = useState<ContentStudioGridItem[]>([]);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [skeletonMode, setSkeletonMode] =
    useState<ContentStudioSkeletonMode>("generate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meerOpen, setMeerOpen] = useState(false);
  const [meerView, setMeerView] = useState<MeerView>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recipes, setRecipes] = useState<ContentStudioTemplateRow[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<ContentStudioDrawerDraft | null>(
    null
  );

  const loadLibrary = useCallback(async () => {
    try {
      const data = await fetchJsonChecked<{
        items?: Array<
          ContentStudioGridItem & {
            prompt?: string;
            media_type?: ContentStudioGridItem["media_type"];
          }
        >;
      }>(`/api/photo-studio/library?klant=${klant}`, {
        credentials: "include",
      });
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

  const loadRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const data = await fetchJsonChecked<{ items?: ContentStudioTemplateRow[] }>(
        `/api/photo-studio/recipes?klant=${klant}&recipes=1`,
        { credentials: "include" }
      );
      setRecipes(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recepten laden mislukt");
    } finally {
      setRecipesLoading(false);
    }
  }, [klant]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary, refreshKey]);

  useEffect(() => {
    if (meerView === "recipes") void loadRecipes();
  }, [meerView, loadRecipes]);

  const onSkeletonCount = (
    count: number,
    mode: ContentStudioSkeletonMode = "generate"
  ) => {
    setSkeletonCount(count);
    if (count > 0) setSkeletonMode(mode);
  };

  const onGenerated = (newItems: ContentStudioGridItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    setRefreshKey((n) => n + 1);
  };

  const openMeer = (view: MeerView) => {
    setError("");
    setMeerView(view);
    setMeerOpen(false);
  };

  const deleteRecipe = async (id: string) => {
    if (!window.confirm("Recept verwijderen?")) return;
    try {
      await fetchJsonChecked(
        `/api/photo-studio/recipes/${encodeURIComponent(id)}?klant=${klant}`,
        { method: "DELETE", credentials: "include" }
      );
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Verwijderen mislukt");
    }
  };

  const errorBanner = error ? (
    <p className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 fumero-text-body-sm text-red-800 md:mx-6 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
      {error}
    </p>
  ) : null;

  if (meerView) {
    const meerTitles: Record<Exclude<MeerView, null>, string> = {
      carousel: "Instagram carrousel",
      menu: "Menu-batch",
      postprocess: "Nabewerking",
      recipes: "Recepten",
    };

    return (
      <div className={`flex h-full min-h-0 flex-col ${className}`}>
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--fumero-border)] px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="fumero-text-body-sm text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
              onClick={() => setMeerView(null)}
            >
              ← Terug
            </button>
            <h1 className="fumero-text-h3 text-[var(--fumero-text)]">
              {meerTitles[meerView]}
            </h1>
          </div>
        </header>
        {errorBanner}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {meerView === "carousel" ? (
            <PhotoStudioCarousel
              klant={klant}
              onDone={() => {
                setRefreshKey((n) => n + 1);
              }}
            />
          ) : null}
          {meerView === "menu" ? (
            <PhotoStudioMenuBatch
              klant={klant}
              onDone={() => setRefreshKey((n) => n + 1)}
            />
          ) : null}
          {meerView === "postprocess" ? (
            <PhotoStudioPostProcess klant={klant} />
          ) : null}
          {meerView === "recipes" ? (
            <div className="mx-auto max-w-lg space-y-3">
              {recipesLoading ? (
                <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
                  Recepten laden…
                </p>
              ) : recipes.length === 0 ? (
                <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
                  Nog geen recepten. Sla een template op via Template → Sla op
                  als recept.
                </p>
              ) : (
                recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--fumero-border)] p-3"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setRecipeDraft(recipeToDraft(recipe));
                        setMeerView(null);
                      }}
                    >
                      <span className="block fumero-text-body-sm font-medium text-[var(--fumero-text)]">
                        {recipe.title}
                      </span>
                      <span className="fumero-text-caption text-[var(--fumero-text-muted)]">
                        {recipe.platform} · {recipe.aspect_ratio}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)] hover:text-red-600"
                      aria-label={`Recept ${recipe.title} verwijderen`}
                      onClick={() => void deleteRecipe(recipe.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <header className="flex shrink-0 items-center justify-between px-4 py-3 md:px-6">
        <h1 className="fumero-text-h2 text-[var(--fumero-text)]">{title}</h1>
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={() => setMeerOpen((o) => !o)}
            aria-expanded={meerOpen}
          >
            Meer
            <ChevronDown className="h-4 w-4 text-[var(--fumero-text-muted)]" />
          </button>
          {meerOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Menu sluiten"
                onClick={() => setMeerOpen(false)}
              />
              <div className="fumero-popover-elevated absolute right-0 z-50 mt-1 min-w-[200px] rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface-elevated,var(--fumero-surface))] py-1 shadow-[var(--fumero-shadow-md)]">
                {(
                  [
                    ["carousel", "Instagram carrousel"],
                    ["menu", "Menu-batch"],
                    ["postprocess", "Nabewerking (Sharp)"],
                    ["recipes", "Recepten"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="block w-full px-3 py-2 text-left fumero-text-body-sm text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                    onClick={() => openMeer(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {errorBanner}

      <ContentStudioOutputGrid
        klant={klant}
        items={items}
        skeletonCount={skeletonCount}
        skeletonMode={skeletonMode}
        onScheduled={() => setRefreshKey((n) => n + 1)}
        onGenerated={onGenerated}
        externalDraft={recipeDraft}
        onExternalDraftClose={() => setRecipeDraft(null)}
      />

      <ContentStudioPromptBar
        klant={klant}
        busy={busy}
        onBusyChange={setBusy}
        onGenerated={onGenerated}
        onSkeletonCount={onSkeletonCount}
        onError={setError}
      />
    </div>
  );
}
