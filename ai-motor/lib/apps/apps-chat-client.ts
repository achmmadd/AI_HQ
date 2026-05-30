import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";

export type FullAppCreateResponse = {
  ok?: boolean;
  app_id?: number;
  slug?: string;
  naam?: string;
  error?: string;
  refined?: boolean;
};

export type AppDetail = {
  id: number;
  slug: string;
  naam: string;
  type: "widget" | "internal" | "customer";
  status: "concept" | "published" | "archived";
  version: number;
  frontend_code?: string | null;
  db_schema?: string | null;
  auth_required?: number;
  updated_at: string;
  // computed for card
  preview_url?: string;
  embed_code?: string | null;
  internal_url?: string | null;
};

export async function createFullApp(prompt: string): Promise<{ app_id?: number; slug: string; naam: string }> {
  const res = await fetch("/api/apps/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const json = (await res.json()) as FullAppCreateResponse & { error?: string };
  if (!res.ok || json.error) {
    throw new Error(formatFumeroBuilderError(json.error || "Full-app genereren mislukt"));
  }
  if (!json.slug) throw new Error("Geen slug teruggekregen van server");
  return {
    app_id: json.app_id,
    slug: json.slug,
    naam: json.naam || "App",
  };
}

/** Fase 5: fetch app detail (for chat card + bewerk flow). */
export async function fetchAppDetail(slug: string): Promise<AppDetail> {
  const res = await fetch(`/api/apps/${encodeURIComponent(slug)}`, { credentials: "include" });
  const json = (await res.json()) as { app?: any; error?: string };
  if (!res.ok || !json.app) throw new Error(json.error || "App laden mislukt");
  const a = json.app;
  const base = `/apps/${a.slug}`;
  const embedBase = `/embed/fumero/app/${a.slug}`;
  return {
    id: a.id,
    slug: a.slug,
    naam: a.naam,
    type: a.type || "internal",
    status: a.status || "concept",
    version: a.version || 1,
    frontend_code: a.frontend_code,
    db_schema: a.db_schema,
    auth_required: a.auth_required ?? 0,
    updated_at: a.updated_at,
    preview_url: a.type === "customer" ? `${embedBase}?preview=1` : `${base}?preview=1`,
    internal_url: base,
    embed_code: a.type === "customer" ? embedBase : (a.type === "widget" ? `<script src="/embed/fumero/app/${a.slug}.js"></script>` : null),
  };
}

/** Fase 5: refine/pas aan existing full app (uses /generate with slug for context load + data preserve). */
export async function iterateFullApp(
  slug: string,
  instruction: string
): Promise<{ slug: string; preview_url?: string }> {
  const res = await fetch("/api/apps/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: instruction, slug, action: "refine" }),
  });
  const json = (await res.json()) as FullAppCreateResponse & { error?: string };
  if (!res.ok || json.error) {
    throw new Error(formatFumeroBuilderError(json.error || "App verfijnen mislukt"));
  }
  const detail = await fetchAppDetail(slug);
  return { slug, preview_url: detail.preview_url };
}

/** Fase 5: publish app (sets status=published, returns detail with urls). */
export async function publishFullApp(slug: string): Promise<AppDetail> {
  const res = await fetch(`/api/apps/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish" }),
  });
  const json = (await res.json()) as { error?: string; app?: any };
  if (!res.ok || json.error) throw new Error(json.error || "Publiceren mislukt");
  // re-fetch for full urls
  return fetchAppDetail(slug);
}
