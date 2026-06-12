import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";

export const runtime = "nodejs";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Async tool/widget generatie (Cloudflare-proof): start achtergrond-job, geef
 * direct 202 + { jobId }. Client pollt /api/fumero/tools/generate/status.
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  try {
    const auth = await requireWorkspaceApi(req, "fumero");
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as {
      action?: "create" | "iterate";
      name?: string;
      prompt?: string;
      deploy_type?: FumeroDeployType;
      template_id?: string;
      tool_id?: number;
    };

    const action = body.action === "iterate" ? "iterate" : "create";
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is verplicht" }, { status: 400 });
    }

    if (action === "create") {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "name is verplicht" }, { status: 400 });
      }
    } else {
      const toolId = Number(body.tool_id);
      if (!Number.isFinite(toolId) || toolId <= 0) {
        return NextResponse.json({ error: "tool_id is verplicht" }, { status: 400 });
      }
    }

    const { startToolGenerationJob } = await import(
      "@/lib/fumero/tool-generation-runner"
    );

    const { jobId } = startToolGenerationJob({
      action,
      klant: "fumero",
      prompt,
      payload: {
        name: body.name,
        deploy_type: body.deploy_type || "widget",
        template_id: body.template_id,
        tool_id: body.tool_id,
      },
    });

    console.info("[api/fumero/tools/generate/start] job started", {
      request_id: requestId,
      job_id: jobId,
      action,
      prompt_chars: prompt.length,
    });

    return NextResponse.json({ ok: true, jobId }, { status: 202 });
  } catch (error) {
    const detail = errorMessage(error);
    console.error("[api/fumero/tools/generate/start] failed", {
      request_id: requestId,
      error: detail.slice(0, 240),
    });
    return NextResponse.json(
      {
        error: "Tool-generatie starten mislukt",
        detail: formatFumeroBuilderError(detail),
      },
      { status: 500 }
    );
  }
}
