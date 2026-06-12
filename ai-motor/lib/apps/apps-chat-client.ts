import { fetchJsonChecked } from "@/lib/fetch-json-client";
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

export type GenerationProgressUpdate = {
  phase?: string | null;
  message?: string | null;
  status?: string;
};

export type CreateFullAppOptions = {
  onProgress?: (update: GenerationProgressUpdate) => void;
  pollIntervalMs?: number;
  maxWaitMs?: number;
};

type GenerationJobPollResponse = {
  ok?: boolean;
  jobId?: string;
  status?: "pending" | "running" | "done" | "error";
  phase?: string | null;
  progress_message?: string | null;
  slug?: string | null;
  result?: Record<string, unknown> | null;
  error?: string;
};

async function pollGenerationJob(
  jobId: string,
  opts?: CreateFullAppOptions
): Promise<{ app_id?: number; slug: string; naam: string }> {
  const pollInterval = opts?.pollIntervalMs ?? 2_000;
  const maxWait = opts?.maxWaitMs ?? 580_000;
  const started = Date.now();

  while (Date.now() - started < maxWait) {
    const json = await fetchJsonChecked<GenerationJobPollResponse>(
      `/api/apps/generate/status?jobId=${encodeURIComponent(jobId)}`,
      { credentials: "include" }
    );

    opts?.onProgress?.({
      phase: json.phase,
      message: json.progress_message,
      status: json.status,
    });

    if (json.status === "done") {
      const result = json.result ?? {};
      const slug = String(json.slug || result.slug || "").trim();
      const naam = String(result.naam || "App").trim();
      const app_id =
        typeof result.app_id === "number" ? result.app_id : undefined;
      if (!slug) throw new Error("Job klaar maar geen slug teruggekregen");
      return { app_id, slug, naam };
    }

    if (json.status === "error") {
      throw new Error(formatFumeroBuilderError(json.error || "App genereren mislukt"));
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("App-generatie duurde te lang — probeer opnieuw");
}

async function startAsyncGeneration(body: Record<string, unknown>): Promise<string> {
  const json = await fetchJsonChecked<{ ok?: boolean; jobId?: string; error?: string }>(
    "/api/apps/generate/start",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!json.jobId) {
    throw new Error(formatFumeroBuilderError(json.error || "Async generatie starten mislukt"));
  }
  return json.jobId;
}

export async function createFullApp(
  prompt: string,
  opts?: CreateFullAppOptions
): Promise<{ app_id?: number; slug: string; naam: string }> {
  const jobId = await startAsyncGeneration({ prompt });
  return pollGenerationJob(jobId, opts);
}

/** Fase 5: fetch app detail (for chat card + bewerk flow). */
export async function fetchAppDetail(slug: string): Promise<AppDetail> {
  const json = await fetchJsonChecked<{ app?: any; error?: string }>(
    `/api/apps/${encodeURIComponent(slug)}`,
    { credentials: "include" }
  );
  if (!json.app) throw new Error(json.error || "App laden mislukt");
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

/** Fase 5: refine/pas aan existing full app (async job + data preserve). */
export async function iterateFullApp(
  slug: string,
  instruction: string,
  opts?: CreateFullAppOptions
): Promise<{ slug: string; preview_url?: string }> {
  const jobId = await startAsyncGeneration({
    prompt: instruction,
    slug,
    action: "refine",
  });
  await pollGenerationJob(jobId, opts);
  const detail = await fetchAppDetail(slug);
  return { slug, preview_url: detail.preview_url };
}

/** Fase 5: publish app (sets status=published, returns detail with urls). */
export async function publishFullApp(slug: string): Promise<AppDetail> {
  const json = await fetchJsonChecked<{ error?: string; app?: any }>(
    `/api/apps/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    }
  );
  if (json.error) throw new Error(json.error || "Publiceren mislukt");
  // re-fetch for full urls
  return fetchAppDetail(slug);
}
