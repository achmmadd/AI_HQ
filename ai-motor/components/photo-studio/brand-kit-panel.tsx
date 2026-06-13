"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { BRAND_LOGO, FUMERO_BRAND } from "@/lib/fumero/brand-assets";
import { dedupeBrandKitColors } from "@/lib/photo-studio/brand-kit/dedupe-colors";
import { formatPriceEur } from "@/lib/photo-studio/brand-kit/format-price";
import { buildImportSummary } from "@/lib/photo-studio/brand-kit/import-summary";
import type {
  BrandKitColor,
  BrandKitColorRole,
  BrandKitData,
  BrandKitImage,
  BrandKitReview,
  BrandKitRow,
} from "@/lib/photo-studio/brand-kit/types";
import { emptyBrandKitDraft, validateBrandKitData } from "@/lib/photo-studio/brand-kit/types";
import { cn } from "@/lib/utils";

export type BrandKitPanelProps = {
  className?: string;
  /** Standalone page vs embedded wizard step 1 */
  variant?: "standalone" | "wizard";
  selectedKitId?: string | null;
  onSelectKit?: (kitId: string) => void;
  /** Called after confirm save — wizard advances to campagnedoel */
  onKitConfirmed?: (kitId: string) => void;
  onKitsLoaded?: (kits: BrandKitRow[]) => void;
};

type ImportPhase = "idle" | "importing" | "review";

const EXAMPLE_PRODUCT_URL =
  "https://fumero.nl/product/kings-hhc-disposable-vape-super-lemon-haze-500mg/";
const FUMERO_PRODUCTS_URL = "https://fumero.nl/product-category/hhc-vapes/";

const COLOR_ROLES: BrandKitColorRole[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
];

function manualDraft(): BrandKitData {
  const draft = emptyBrandKitDraft("manual");
  draft.name = "Nieuw Brand Kit";
  draft.logo_url = BRAND_LOGO.src;
  draft.colors = [
    { hex: FUMERO_BRAND.accent, label: "Fumero accent", role: "accent" },
    { hex: FUMERO_BRAND.logoGreen, label: "Fumero groen", role: "primary" },
  ];
  return draft;
}

async function uploadImage(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  form.append("klant", "fumero");
  const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { media_url?: string };
  return data.media_url ?? null;
}

export function BrandKitPanel({
  className,
  variant = "standalone",
  selectedKitId = null,
  onSelectKit,
  onKitConfirmed,
  onKitsLoaded,
}: BrandKitPanelProps) {
  const isWizard = variant === "wizard";
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [saving, setSaving] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [draft, setDraft] = useState<BrandKitData | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [kits, setKits] = useState<BrandKitRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [kitsLoading, setKitsLoading] = useState(true);
  const [kitsLoadError, setKitsLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const loadKits = useCallback(async () => {
    setKitsLoadError(null);
    try {
      const res = await fetch("/api/photo-studio/brand-kit?klant=fumero", {
        credentials: "include",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        throw new Error(`Brand Kits laden mislukt (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { items?: BrandKitRow[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setKits(items);
      onKitsLoaded?.(items);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Brand Kits laden mislukt — vernieuw de pagina.";
      setKitsLoadError(msg);
    }
  }, [onKitsLoaded]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setKitsLoading(true);
      setKitsLoadError(null);
      try {
        const res = await fetch("/api/photo-studio/brand-kit?klant=fumero", {
          credentials: "include",
          signal: AbortSignal.timeout(15_000),
        });
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(`Brand Kits laden mislukt (HTTP ${res.status}).`);
        }
        const data = (await res.json()) as { items?: BrandKitRow[] };
        const items = Array.isArray(data.items) ? data.items : [];
        setKits(items);
        onKitsLoaded?.(items);
      } catch (e) {
        if (!cancelled) {
          setKitsLoadError(
            e instanceof Error ? e.message : "Brand Kits laden mislukt — vernieuw de pagina."
          );
        }
      } finally {
        if (!cancelled) setKitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onKitsLoaded]);

  const persistDraft = async (
    draftToSave: BrandKitData,
    confirm: boolean
  ): Promise<BrandKitRow | null> => {
    const payload: BrandKitData = {
      ...draftToSave,
      status: confirm ? "confirmed" : "draft",
    };
    const validationError = validateBrandKitData(payload);
    if (validationError) {
      setError(validationError);
      return null;
    }

    const endpoint = savedId
      ? `/api/photo-studio/brand-kit/${savedId}`
      : "/api/photo-studio/brand-kit";
    const res = await fetch(endpoint, {
      method: savedId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ klant: "fumero", data: payload }),
    });
    const data = (await res.json()) as { error?: string; item?: BrandKitRow };
    if (!res.ok) throw new Error(data.error ?? "Opslaan mislukt.");
    if (data.item) {
      setSavedId(data.item.id);
      setDraft(data.item);
      if (confirm) {
        onSelectKit?.(data.item.id);
        onKitConfirmed?.(data.item.id);
      }
    }
    await loadKits();
    return data.item ?? null;
  };

  const cancelReview = () => {
    setDraft(null);
    setSavedId(null);
    setPhase("idle");
    setError(null);
    setImportNote(null);
    setElapsedMs(null);
  };

  const startManual = () => {
    setError(null);
    setImportNote(null);
    setSavedId(null);
    setDraft(manualDraft());
    setPhase("review");
  };

  const importFromUrl = async () => {
    const url = productUrl.trim();
    if (!url) {
      setError("Voer een fumero.nl product-URL in.");
      return;
    }
    setPhase("importing");
    setError(null);
    setImportNote(null);
    setSavedId(null);

    try {
      const res = await fetch("/api/photo-studio/brand-kit/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ klant: "fumero", url }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        draft?: BrandKitData;
        fallback?: BrandKitData;
        error?: string;
        elapsed_ms?: number;
      };

      if (data.ok && data.draft) {
        const importedDraft = {
          ...data.draft,
          colors: dedupeBrandKitColors(data.draft.colors),
        };
        setDraft(importedDraft);
        setElapsedMs(data.elapsed_ms ?? null);
        if (data.draft.import_warnings?.length) {
          setImportNote(data.draft.import_warnings.join(" "));
        }
        setPhase("review");

        if (isWizard) {
          const canAutoConfirm = !validateBrandKitData({
            ...importedDraft,
            status: "confirmed",
          });
          if (canAutoConfirm) {
            setSaving(true);
            try {
              const saved = await persistDraft(importedDraft, true);
              if (saved) {
                setImportNote("Import gelukt — Brand Kit bevestigd. Ga verder naar campagnedoel.");
                return;
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Auto-bevestigen mislukt.");
            } finally {
              setSaving(false);
            }
          }
        }
        return;
      }

      if (data.fallback) {
        setDraft(data.fallback);
        setImportNote(data.error ?? "Import mislukt — vul handmatig aan.");
        setPhase("review");
        return;
      }

      setError(data.error ?? "Import mislukt.");
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import mislukt.");
      setPhase("idle");
    }
  };

  const saveDraft = async (confirm = false) => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await persistDraft(draft, confirm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  };

  const selectConfirmedKit = (kit: BrandKitRow) => {
    if (kit.status !== "confirmed") return;
    onSelectKit?.(kit.id);
    setError(null);
  };

  const loadKit = (kit: BrandKitRow) => {
    setSavedId(kit.id);
    setDraft({
      name: kit.name,
      product_name: kit.product_name,
      price: kit.price,
      currency: kit.currency,
      description: kit.description,
      source_url: kit.source_url,
      source: kit.source,
      reviews: kit.reviews,
      images: kit.images,
      colors: dedupeBrandKitColors(kit.colors),
      logo_url: kit.logo_url,
      status: kit.status,
      import_warnings: kit.import_warnings,
    });
    setPhase("review");
    setError(null);
    setImportNote(null);
  };

  const deleteKit = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Brand Kit "${name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/photo-studio/brand-kit/${id}?klant=fumero`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Verwijderen mislukt.");
      }
      if (savedId === id) {
        setSavedId(null);
        setDraft(null);
        setPhase("idle");
      }
      await loadKits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verwijderen mislukt.");
    }
  };

  const handleLogoUpload = async (file: File) => {
    const url = await uploadImage(file);
    if (!url) {
      setError("Logo upload mislukt.");
      return;
    }
    setDraft((d) => (d ? { ...d, logo_url: url } : d));
  };

  const handleProductUpload = async (file: File) => {
    const url = await uploadImage(file);
    if (!url) {
      setError("Productfoto upload mislukt.");
      return;
    }
    setDraft((d) => {
      if (!d) return d;
      const images: BrandKitImage[] = [
        { url, alt: d.product_name, role: "product" },
        ...d.images.filter((i) => i.role !== "product"),
      ];
      return { ...d, images };
    });
  };

  const updateField = <K extends keyof BrandKitData>(key: K, value: BrandKitData[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const updateReview = (index: number, patch: Partial<BrandKitReview>) => {
    setDraft((d) => {
      if (!d) return d;
      const reviews = [...d.reviews];
      reviews[index] = { ...reviews[index], ...patch };
      return { ...d, reviews };
    });
  };

  const updateColor = (index: number, patch: Partial<BrandKitColor>) => {
    setDraft((d) => {
      if (!d) return d;
      const colors = [...d.colors];
      colors[index] = { ...colors[index], ...patch };
      return { ...d, colors };
    });
  };

  const addColor = () => {
    setDraft((d) =>
      d
        ? {
            ...d,
            colors: dedupeBrandKitColors([
              ...d.colors,
              { hex: "#000000", label: "Nieuw", role: "neutral" },
            ]),
          }
        : d
    );
  };

  const removeColor = (index: number) => {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, colors: d.colors.filter((_, i) => i !== index) };
    });
  };

  const setPrimaryImage = (url: string) => {
    setDraft((d) => {
      if (!d) return d;
      const images = d.images.map((img) => ({
        ...img,
        role: img.url === url ? ("product" as const) : img.role === "product" ? ("gallery" as const) : img.role,
      }));
      const primary = images.find((i) => i.url === url);
      const rest = images.filter((i) => i.url !== url);
      return { ...d, images: primary ? [primary, ...rest] : images };
    });
  };

  const removeImage = (url: string) => {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, images: d.images.filter((i) => i.url !== url) };
    });
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setDraft((d) => {
      if (!d) return d;
      const next = index + direction;
      if (next < 0 || next >= d.images.length) return d;
      const images = [...d.images];
      [images[index], images[next]] = [images[next], images[index]];
      return { ...d, images };
    });
  };

  const resyncFromSource = async () => {
    if (!draft?.source_url) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/photo-studio/brand-kit/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ klant: "fumero", url: draft.source_url }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        draft?: BrandKitData;
        fallback?: BrandKitData;
        error?: string;
        elapsed_ms?: number;
      };
      const imported = data.ok && data.draft ? data.draft : data.fallback;
      if (!imported) {
        throw new Error(data.error ?? "Synchroniseren mislukt.");
      }
      setDraft((prev) =>
        prev
          ? {
              ...imported,
              name: prev.name,
              status: prev.status,
              colors: dedupeBrandKitColors(imported.colors),
            }
          : {
              ...imported,
              colors: dedupeBrandKitColors(imported.colors),
            }
      );
      setImportNote(
        data.ok
          ? "Gesynchroniseerd vanaf bron-URL."
          : (data.error ?? "Gedeeltelijk gesynchroniseerd — controleer velden.")
      );
      setElapsedMs(data.elapsed_ms ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synchroniseren mislukt.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {!isWizard ? (
        <header className="space-y-1">
          <h1 className="fumero-text-heading text-[var(--fumero-text)]">Brand Kit</h1>
          <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Importeer productinfo van fumero.nl of upload logo en productfoto. Controleer en
            bevestig voordat je verder gaat met campagnes.
          </p>
        </header>
      ) : (
        <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
          Importeer een product van fumero.nl, maak handmatig een Brand Kit, of kies een
          opgeslagen kit. Bevestig of selecteer een kit om verder te gaan met je campagne.
        </p>
      )}

      {phase === "idle" || phase === "importing" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
            <div className="mb-3 flex items-center gap-2 text-[var(--fumero-text)]">
              <Link2 className="h-4 w-4" />
              <h2 className="fumero-text-body font-semibold">Product-URL</h2>
            </div>
            <p className="mb-4 fumero-text-body-sm text-[var(--fumero-text-muted)]">
              Plak een fumero.nl productpagina — naam, prijs, beschrijving, reviews en
              afbeeldingen worden automatisch ingelezen.
            </p>
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder={EXAMPLE_PRODUCT_URL}
              className="mb-2 w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 fumero-text-body-sm text-[var(--fumero-text)] outline-none focus:border-[var(--fumero-accent)]"
              disabled={phase === "importing"}
            />
            <p className="mb-3 fumero-text-caption text-[var(--fumero-text-muted)]">
              <button
                type="button"
                onClick={() => setProductUrl(EXAMPLE_PRODUCT_URL)}
                className="text-[var(--fumero-accent)] underline"
              >
                Voorbeeld-URL gebruiken
              </button>
              {" · "}
              <a
                href={FUMERO_PRODUCTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--fumero-accent)] underline"
              >
                Kies product op fumero.nl
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <button
              type="button"
              onClick={() => void importFromUrl()}
              disabled={phase === "importing"}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--fumero-accent)] px-4 fumero-text-body-sm font-semibold text-[var(--fumero-accent-foreground)] disabled:opacity-60"
            >
              {phase === "importing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importeren…
                </>
              ) : (
                "Importeren"
              )}
            </button>
          </div>

          <div className="rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
            <div className="mb-3 flex items-center gap-2 text-[var(--fumero-text)]">
              <Upload className="h-4 w-4" />
              <h2 className="fumero-text-body font-semibold">Handmatig</h2>
            </div>
            <p className="mb-4 fumero-text-body-sm text-[var(--fumero-text-muted)]">
              Geen product-URL? Start met een leeg Brand Kit en upload logo plus
              productfoto.
            </p>
            <button
              type="button"
              onClick={startManual}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--fumero-border)] px-4 fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
            >
              Handmatig starten
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--fumero-danger-border)] bg-[var(--fumero-danger-bg)] px-3 py-2 fumero-text-body-sm text-[var(--fumero-danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {importNote ? (
        <p className="rounded-lg border border-[var(--fumero-warning-border,var(--fumero-border))] bg-[var(--fumero-warning-bg,var(--fumero-surface-muted))] px-3 py-2 fumero-text-body-sm text-[var(--fumero-text-muted)]">
          {importNote}
          {elapsedMs != null ? ` (${(elapsedMs / 1000).toFixed(1)}s)` : ""}
        </p>
      ) : null}

      {phase === "review" && draft && draft.source === "url_import" ? (
        <ul className="space-y-1 rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-4 py-3 fumero-text-body-sm">
          {buildImportSummary(draft).map((line) => (
            <li
              key={line.text}
              className={cn(
                "flex items-center gap-2",
                line.ok ? "text-[var(--fumero-text)]" : "text-[var(--fumero-text-muted)]"
              )}
            >
              <span aria-hidden>{line.ok ? "✓" : "⚠"}</span>
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}

      {phase === "review" && draft ? (
        <section className="space-y-6 rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="fumero-text-body font-semibold text-[var(--fumero-text)]">
              Brand Kit controleren
            </h2>
            <div className="flex flex-wrap gap-2">
              {draft.source_url ? (
                <button
                  type="button"
                  onClick={() => void resyncFromSource()}
                  disabled={syncing || saving}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)] disabled:opacity-60"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Synchroniseren vanaf bron-URL
                </button>
              ) : null}
              <button
                type="button"
                onClick={cancelReview}
                className="h-9 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => void saveDraft(false)}
                disabled={saving}
                className="h-9 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)] disabled:opacity-60"
              >
                Concept opslaan
              </button>
              <button
                type="button"
                onClick={() => void saveDraft(true)}
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--fumero-accent)] px-4 fumero-text-body-sm font-semibold text-[var(--fumero-accent-foreground)] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Bevestigen
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Kit-naam
              </span>
              <input
                value={draft.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 fumero-text-body-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Productnaam
              </span>
              <input
                value={draft.product_name}
                onChange={(e) => updateField("product_name", e.target.value)}
                className="w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 fumero-text-body-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Prijs
                {draft.price ? (
                  <span className="ml-2 font-normal text-[var(--fumero-text)]">
                    ({formatPriceEur(draft.price, draft.currency) ?? draft.price})
                  </span>
                ) : null}
              </span>
              <input
                value={draft.price ?? ""}
                onChange={(e) => updateField("price", e.target.value || null)}
                placeholder="24.95"
                className="w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 fumero-text-body-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Valuta
              </span>
              <input
                value={draft.currency}
                onChange={(e) => updateField("currency", e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 fumero-text-body-sm"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
              Beschrijving
            </span>
            <textarea
              value={draft.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] px-3 py-2 fumero-text-body-sm"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Logo
              </span>
              <div className="flex items-center gap-3">
                {draft.logo_url ? (
                  <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-[var(--fumero-border)] bg-white">
                    <Image
                      src={draft.logo_url}
                      alt="Logo"
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>
                ) : null}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLogoUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="h-9 rounded-lg border border-dashed border-[var(--fumero-border)] px-3 fumero-text-body-sm text-[var(--fumero-text-muted)] hover:border-[var(--fumero-accent)]"
                >
                  Logo uploaden
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Productfoto
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {draft.images
                  .filter((i) => i.role === "product" || !i.role)
                  .slice(0, 1)
                  .map((img) => (
                    <div
                      key={img.url}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--fumero-border)]"
                    >
                      <Image
                        src={img.url}
                        alt={img.alt ?? "Product"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                <input
                  ref={productInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleProductUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => productInputRef.current?.click()}
                  className="h-9 rounded-lg border border-dashed border-[var(--fumero-border)] px-3 fumero-text-body-sm text-[var(--fumero-text-muted)] hover:border-[var(--fumero-accent)]"
                >
                  Productfoto uploaden
                </button>
              </div>
            </div>
          </div>

          {draft.images.length ? (
            <div className="space-y-2">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Galerij ({draft.images.length})
              </span>
              <div className="flex flex-wrap gap-3">
                {draft.images.map((img, i) => (
                  <div key={img.url} className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "relative h-14 w-14 overflow-hidden rounded-lg border",
                        img.role === "product"
                          ? "border-[var(--fumero-accent)] ring-2 ring-[var(--fumero-accent-muted)]"
                          : "border-[var(--fumero-border)]"
                      )}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt ?? ""}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)] disabled:opacity-30"
                        aria-label="Naar links"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(img.url)}
                        className="fumero-text-caption text-[var(--fumero-accent)]"
                      >
                        {img.role === "product" ? "Hoofdfoto" : "Als hoofd"}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(i, 1)}
                        disabled={i === draft.images.length - 1}
                        className="rounded p-0.5 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)] disabled:opacity-30"
                        aria-label="Naar rechts"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(img.url)}
                        className="rounded p-0.5 text-[var(--fumero-danger)] hover:bg-[var(--fumero-danger-bg)]"
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Kleuren
              </span>
              <button
                type="button"
                onClick={addColor}
                className="inline-flex items-center gap-1 fumero-text-caption text-[var(--fumero-accent)]"
              >
                <Plus className="h-3 w-3" />
                Toevoegen
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.colors.map((color, i) => (
                <div
                  key={`${color.hex}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-[var(--fumero-border)] px-2 py-1"
                >
                  <input
                    type="color"
                    value={color.hex}
                    onChange={(e) =>
                      updateColor(i, { hex: e.target.value })
                    }
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`Kleur ${i + 1}`}
                  />
                  <input
                    value={color.label ?? ""}
                    onChange={(e) => updateColor(i, { label: e.target.value })}
                    placeholder="Label"
                    className="w-20 bg-transparent fumero-text-caption outline-none"
                  />
                  <select
                    value={color.role ?? "neutral"}
                    onChange={(e) =>
                      updateColor(i, { role: e.target.value as BrandKitColorRole })
                    }
                    className="rounded border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-1 py-0.5 fumero-text-caption"
                    aria-label="Kleurrol"
                  >
                    {COLOR_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    className="text-[var(--fumero-text-muted)] hover:text-[var(--fumero-danger)]"
                    aria-label="Kleur verwijderen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {draft.reviews.length ? (
            <div className="space-y-2">
              <span className="fumero-text-caption font-medium text-[var(--fumero-text-muted)]">
                Reviews ({draft.reviews.length})
              </span>
              <ul className="space-y-2">
                {draft.reviews.map((review, i) => (
                  <li
                    key={`review-${i}`}
                    className="rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface-muted)] p-3"
                  >
                    <div className="mb-2 flex gap-2">
                      <input
                        value={review.author ?? ""}
                        onChange={(e) => updateReview(i, { author: e.target.value })}
                        placeholder="Auteur"
                        className="flex-1 rounded border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-2 py-1 fumero-text-caption"
                      />
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.1}
                        value={review.rating ?? ""}
                        onChange={(e) =>
                          updateReview(i, {
                            rating: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="★"
                        className="w-16 rounded border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-2 py-1 fumero-text-caption"
                      />
                    </div>
                    <textarea
                      value={review.text ?? ""}
                      onChange={(e) => updateReview(i, { text: e.target.value })}
                      rows={2}
                      className="w-full rounded border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-2 py-1 fumero-text-caption"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {savedId && draft.status === "confirmed" ? (
            <p className="flex items-center gap-2 fumero-text-body-sm text-[var(--fumero-accent)]">
              <Check className="h-4 w-4" />
              Brand Kit bevestigd en opgeslagen.
              {isWizard ? " Je gaat automatisch verder naar campagnedoel." : null}
            </p>
          ) : null}

          {!isWizard && savedId && draft.status === "confirmed" ? (
            <Link
              href="/fumero/campaign-studio"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--fumero-accent)] px-3 fumero-text-body-sm font-medium text-[var(--fumero-accent)] hover:bg-[var(--fumero-accent-muted)]"
            >
              <Megaphone className="h-4 w-4" />
              Start campagne
            </Link>
          ) : null}
        </section>
      ) : null}

      {kitsLoadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--fumero-danger-border)] bg-[var(--fumero-danger-bg)] px-4 py-3 fumero-text-body-sm text-[var(--fumero-danger)]">
          <span>{kitsLoadError}</span>
          <button
            type="button"
            onClick={() => void loadKits()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--fumero-danger-border)] px-3 fumero-text-caption font-medium hover:bg-white/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Opnieuw
          </button>
        </div>
      ) : null}

      {kitsLoading ? (
        <section className="space-y-3" aria-busy="true" aria-label="Brand Kits laden">
          <h2 className="fumero-text-body font-semibold text-[var(--fumero-text)]">
            Opgeslagen Brand Kits
          </h2>
          <ul className="divide-y divide-[var(--fumero-border)] rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
            {[0, 1].map((i) => (
              <li key={i} className="px-4 py-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--fumero-surface-muted)]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[var(--fumero-surface-muted)]" />
              </li>
            ))}
          </ul>
        </section>
      ) : kits.length ? (
        <section className="space-y-3">
          <h2 className="fumero-text-body font-semibold text-[var(--fumero-text)]">
            Opgeslagen Brand Kits
          </h2>
          <ul className="divide-y divide-[var(--fumero-border)] rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface)]">
            {kits.map((kit) => {
              const isConfirmed = kit.status === "confirmed";
              const isSelected = isWizard && isConfirmed && selectedKitId === kit.id;
              return (
                <li
                  key={kit.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
                    isSelected && "bg-[var(--fumero-accent-muted)]",
                    isWizard && !isConfirmed && "opacity-75"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isWizard && !isConfirmed) {
                        setError(
                          "Dit is een concept-kit — bevestig eerst via Bewerken voordat je verder gaat."
                        );
                        loadKit(kit);
                        return;
                      }
                      if (isWizard && isConfirmed) {
                        selectConfirmedKit(kit);
                        return;
                      }
                      loadKit(kit);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate fumero-text-body-sm font-medium text-[var(--fumero-text)]">
                      {isSelected ? (
                        <span className="mr-1 inline-flex items-center gap-1 text-[var(--fumero-accent)]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      {kit.name}
                      {!isConfirmed ? (
                        <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 fumero-text-caption font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          Concept
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate fumero-text-caption text-[var(--fumero-text-muted)]">
                      {kit.product_name}
                      {formatPriceEur(kit.price, kit.currency)
                        ? ` · ${formatPriceEur(kit.price, kit.currency)}`
                        : ""}
                      {kit.status === "confirmed" ? " · bevestigd" : " · concept"}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    {isWizard && kit.status === "confirmed" ? (
                      <button
                        type="button"
                        onClick={() => loadKit(kit)}
                        className="rounded-lg px-2 py-1 fumero-text-caption text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
                      >
                        Bewerken
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void deleteKit(kit.id, kit.name)}
                      className="rounded-lg p-2 text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-danger-bg)] hover:text-[var(--fumero-danger)]"
                      aria-label="Verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
