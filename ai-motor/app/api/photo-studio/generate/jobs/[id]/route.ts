import { NextRequest, NextResponse } from "next/server";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";
import { getStudioVideoJobStatus } from "@/lib/photo-studio/studio-video-runner";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Poll async Content Studio video generation. */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePhotoStudioKlant(req);
    if (!auth.ok) return auth.response;

    const { id: jobId } = await context.params;
    if (!jobId?.trim()) {
      return NextResponse.json({ error: "job_id is verplicht." }, { status: 400 });
    }

    const job = getStudioVideoJobStatus(jobId.trim(), auth.klant);
    if (!job) {
      return NextResponse.json({ error: "Job niet gevonden." }, { status: 404 });
    }

    if (job.status === "error") {
      return NextResponse.json({
        ok: false,
        job_id: job.jobId,
        jobId: job.jobId,
        status: job.status,
        phase: job.phase,
        progress_message: job.progressMessage,
        error: job.error || "Video genereren mislukt.",
      });
    }

    if (job.status === "done") {
      return NextResponse.json({
        ok: true,
        job_id: job.jobId,
        jobId: job.jobId,
        status: job.status,
        phase: job.phase,
        progress_message: job.progressMessage,
        ...(job.result ?? {}),
      });
    }

    return NextResponse.json({
      ok: true,
      job_id: job.jobId,
      jobId: job.jobId,
      status: job.status,
      phase: job.phase,
      progress_message: job.progressMessage,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[api/photo-studio/generate/jobs/[id]]", e);
    return NextResponse.json(
      { error: "Jobstatus ophalen mislukt.", detail },
      { status: 500 }
    );
  }
}
