import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  createTool,
  generateToolHtml,
  listGarageTools,
} from "@/lib/fumero/tools-service";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";
import {
  fumeroCustomerEmbedCode,
  fumeroInternalAppUrl,
  fumeroWidgetEmbedCode,
} from "@/lib/fumero/public-url";

export const runtime = "nodejs";

function deployUrls(slug: string, deployType: FumeroDeployType) {
  if (deployType === "internal") {
    return { internal_url: fumeroInternalAppUrl(slug) };
  }
  if (deployType === "customer") {
    return {
      customer_url: fumeroCustomerEmbedCode(slug),
      embed_code: fumeroCustomerEmbedCode(slug),
    };
  }
  return { embed_code: fumeroWidgetEmbedCode(slug) };
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const tools = listGarageTools().map((t) => ({
    ...t,
    ...deployUrls(t.slug, t.deploy_type),
  }));
  return NextResponse.json({ tools });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sync fallback — UI gebruikt /api/fumero/tools/generate/start (202 + poll). */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceApi(req, "fumero");
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      prompt?: string;
      deploy_type?: FumeroDeployType;
      template_id?: string;
    };

    const name = String(body.name || "").trim();
    const prompt = String(body.prompt || "").trim();
    const deployType = (body.deploy_type || "widget") as FumeroDeployType;
    if (!name || !prompt) {
      return NextResponse.json({ error: "name en prompt verplicht" }, { status: 400 });
    }

    const gen = await generateToolHtml(deployType, prompt, body.template_id);
    if ("error" in gen) {
      return NextResponse.json(
        { error: formatFumeroBuilderError(gen.error) },
        { status: 503 }
      );
    }

    const created = createTool({
      name,
      prompt,
      deployType,
      templateId: body.template_id,
      code: gen.html,
    });
    if ("error" in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    const tool = listGarageTools().find((t) => t.id === created.toolId);
    return NextResponse.json({
      ok: true,
      tool_id: created.toolId,
      version_id: created.versionId,
      tool,
    });
  } catch (error) {
    const detail = errorMessage(error);
    console.error("[api/fumero/tools] POST failed", { error: detail.slice(0, 240) });
    return NextResponse.json(
      {
        error: formatFumeroBuilderError(detail),
        detail: detail.slice(0, 500),
      },
      { status: 500 }
    );
  }
}
