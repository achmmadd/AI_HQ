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

export async function POST(req: NextRequest) {
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

  let code: string | undefined;
  const gen = await generateToolHtml(deployType, prompt, body.template_id);
  if ("error" in gen) {
    return NextResponse.json({ error: formatFumeroBuilderError(gen.error) }, { status: 503 });
  }
  code = gen.html;

  const created = createTool({
    name,
    prompt,
    deployType,
    templateId: body.template_id,
    code,
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
}
