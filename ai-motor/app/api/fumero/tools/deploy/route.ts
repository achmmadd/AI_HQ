import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  createTool,
  generateToolHtml,
  publishTool,
  updateConceptCode,
} from "@/lib/fumero/tools-service";
import { getToolById } from "@/lib/fumero/tools-db";
import {
  fumeroCustomerEmbedCode,
  fumeroInternalAppUrl,
  fumeroWidgetEmbedCode,
} from "@/lib/fumero/public-url";

export const runtime = "nodejs";

/** Legacy deploy: update concept + publish in één stap. */
export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    tool_id?: number;
    name?: string;
    prompt?: string;
    code?: string;
    publish?: boolean;
  };

  let toolId = Number(body.tool_id);
  if (!toolId) {
    const name = String(body.name || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!name || !prompt) {
      return NextResponse.json({ error: "name en prompt verplicht" }, { status: 400 });
    }
    const gen = await generateToolHtml("widget", prompt);
    if ("error" in gen) {
      return NextResponse.json({ error: gen.error }, { status: 503 });
    }
    const created = createTool({
      name,
      prompt,
      deployType: "widget",
      code: gen.html,
    });
    if ("error" in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
    toolId = created.toolId;
  }

  if (!toolId) {
    return NextResponse.json({ error: "tool_id ontbreekt" }, { status: 400 });
  }

  if (body.prompt) {
    const u = await updateConceptCode(toolId, body.prompt, body.code);
    if ("error" in u) return NextResponse.json({ error: u.error }, { status: 503 });
  }

  if (body.publish !== false) {
    const pub = publishTool(toolId);
    if ("error" in pub) return NextResponse.json({ error: pub.error }, { status: 400 });
  }

  const tool = getToolById(toolId);
  if (!tool) return NextResponse.json({ error: "not found" }, { status: 404 });

  const embed =
    tool.deploy_type === "customer"
      ? fumeroCustomerEmbedCode(tool.slug)
      : tool.deploy_type === "internal"
        ? fumeroInternalAppUrl(tool.slug)
        : fumeroWidgetEmbedCode(tool.slug);

  return NextResponse.json({
    ok: true,
    tool: { id: tool.id, name: tool.name, slug: tool.slug, embed_code: embed },
  });
}
