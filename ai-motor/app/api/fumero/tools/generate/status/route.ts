import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";

export const runtime = "nodejs";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Status-poll voor async tool/widget generatie. */
export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  try {
    const auth = await requireWorkspaceApi(req, "fumero");
    if (!auth.ok) return auth.response;

    const jobId = new URL(req.url).searchParams.get("jobId")?.trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is verplicht" }, { status: 400 });
    }

    const { getToolGenerationJobStatus } = await import(
      "@/lib/fumero/tool-generation-runner"
    );
    const job = getToolGenerationJobStatus(jobId, "fumero");
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
        error: formatFumeroBuilderError(job.error || "Genereren mislukt"),
      });
    }

    return NextResponse.json({
      ok: true,
      jobId: job.jobId,
      status: job.status,
      phase: job.phase,
      progress_message: job.progressMessage,
      result: job.result,
    });
  } catch (error) {
    const detail = errorMessage(error);
    console.error("[api/fumero/tools/generate/status] failed", {
      request_id: requestId,
      error: detail.slice(0, 240),
    });
    return NextResponse.json(
      {
        error: "Status ophalen mislukt",
        detail: formatFumeroBuilderError(detail),
      },
      { status: 500 }
    );
  }
}
