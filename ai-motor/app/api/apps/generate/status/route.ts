import { NextRequest, NextResponse } from "next/server";
import { requireScopedWorkspaceApi } from "@/lib/auth-guards";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";

export const runtime = "nodejs";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Status-poll voor een async full-app generatie-job. */
export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  try {
    const auth = await requireScopedWorkspaceApi(req);
    if (!auth.ok) return auth.response;

    const { ensureAppsSchema } = await import("@/lib/apps/apps-db");
    const { getGenerationJobStatus } = await import(
      "@/lib/apps/app-generation-runner"
    );
    ensureAppsSchema();

    const jobId = new URL(req.url).searchParams.get("jobId")?.trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is verplicht" }, { status: 400 });
    }

    const explicit = req.nextUrl.searchParams.get("klant")?.trim();
    const klant = auth.sessionScope === "all" ? explicit || "fumero" : auth.sessionScope;

    const job = getGenerationJobStatus(jobId, klant);
    if (!job) {
      return NextResponse.json({ error: "Job niet gevonden" }, { status: 404 });
    }

    if (job.status === "error") {
      return NextResponse.json({
        ok: false,
        jobId: job.jobId,
        status: job.status,
        phase: job.phase,
        progress_message: job.progressMessage,
        plan: job.plan,
        error: formatFumeroBuilderError(job.error || "App genereren mislukt"),
      });
    }

    return NextResponse.json({
      ok: true,
      jobId: job.jobId,
      status: job.status,
      slug: job.slug,
      phase: job.phase,
      progress_message: job.progressMessage,
      plan: job.plan,
      result: job.result,
    });
  } catch (error) {
    const detail = errorMessage(error);
    console.error("[api/apps/generate/status] failed", {
      request_id: requestId,
      error: detail.slice(0, 240),
    });
    return NextResponse.json(
      {
        error: "Status ophalen mislukt",
        detail: formatFumeroBuilderError(detail),
        path: new URL(req.url).pathname,
      },
      { status: 500 }
    );
  }
}
