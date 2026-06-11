import { NextRequest, NextResponse } from "next/server";
import { requireScopedWorkspaceApi } from "@/lib/auth-guards";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";

export const runtime = "nodejs";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Async full-app generatie (Cloudflare-proof): start een achtergrond-job en
 * geef direct 202 + { jobId } terug. De client pollt /api/apps/generate/status.
 * Hiermee verdwijnt de 524-time-out en krijgt de builder z'n natuurlijke tijd.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);
  try {
    const auth = await requireScopedWorkspaceApi(req);
    if (!auth.ok) return auth.response;

    const { ensureAppsSchema } = await import("@/lib/apps/apps-db");
    const { startGenerationJob } = await import("@/lib/apps/app-generation-runner");
    ensureAppsSchema();

    const body = (await req.json().catch(() => ({}))) as {
      prompt?: string;
      klant?: string;
      slug?: string;
      action?: string;
    };
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is verplicht" }, { status: 400 });
    }

    const explicit = body.klant?.trim();
    const klant = auth.sessionScope === "all" ? explicit || "fumero" : auth.sessionScope;

    const targetSlug = (body.slug || "").trim();
    const isRefine = body.action === "refine" || !!targetSlug;
    const safeSlug = targetSlug
      ? targetSlug.replace(/[^a-z0-9-]/gi, "").toLowerCase()
      : null;

    const { jobId } = startGenerationJob({
      action: isRefine && safeSlug ? "refine" : "create",
      klant,
      prompt,
      slug: isRefine ? safeSlug : null,
    });

    console.info("[api/apps/generate/start] job started", {
      request_id: requestId,
      job_id: jobId,
      klant,
      action: isRefine && safeSlug ? "refine" : "create",
      slug: safeSlug,
      prompt_chars: prompt.length,
      elapsed_ms: Date.now() - started,
    });

    return NextResponse.json({ ok: true, jobId }, { status: 202 });
  } catch (error) {
    const detail = errorMessage(error);
    console.error("[api/apps/generate/start] failed", {
      request_id: requestId,
      elapsed_ms: Date.now() - started,
      error: detail.slice(0, 240),
    });
    return NextResponse.json(
      {
        error: "App-generatie starten mislukt",
        detail: formatFumeroBuilderError(detail),
        path: new URL(req.url).pathname,
      },
      { status: 500 }
    );
  }
}
