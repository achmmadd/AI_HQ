import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { getCampaignJobStatus } from "@/lib/photo-studio/campaign/campaign-generation-runner";
import { getCampaignStudioConfig } from "@/lib/photo-studio/campaign/studio-config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Status-poll voor async campaign pack generatie. */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireWorkspaceApi(req, "fumero");
    if (!auth.ok) return auth.response;

    const { id: jobId } = await context.params;
    if (!jobId?.trim()) {
      return NextResponse.json({ error: "job_id is verplicht." }, { status: 400 });
    }

    const job = getCampaignJobStatus(jobId.trim(), "fumero");
    if (!job) {
      return NextResponse.json({ error: "Job niet gevonden." }, { status: 404 });
    }

    const config = getCampaignStudioConfig();

    if (job.status === "error") {
      return NextResponse.json({
        ok: false,
        job_id: job.jobId,
        jobId: job.jobId,
        status: job.status,
        pack_id: job.packId,
        phase: job.phase,
        progress: job.progress,
        progress_message: job.progressMessage,
        pack: job.pack,
        partial: Boolean(job.pack && job.result?.partial),
        error: job.error || "Campaign pack genereren mislukt.",
        config,
      });
    }

    if (job.status === "done") {
      return NextResponse.json({
        ok: true,
        job_id: job.jobId,
        jobId: job.jobId,
        status: job.status,
        pack_id: job.packId,
        phase: job.phase,
        progress: job.progress,
        progress_message: job.progressMessage,
        download_url: job.packId
          ? `/api/fumero/campaign/${job.packId}/download`
          : null,
        pack: job.pack,
        result: job.result,
        config,
      });
    }

    return NextResponse.json({
      ok: true,
      job_id: job.jobId,
      jobId: job.jobId,
      status: job.status,
      pack_id: job.packId,
      phase: job.phase,
      progress: job.progress,
      progress_message: job.progressMessage,
      config,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[api/fumero/campaign/jobs/[id]]", e);
    return NextResponse.json(
      { error: "Jobstatus ophalen mislukt.", detail },
      { status: 500 }
    );
  }
}
