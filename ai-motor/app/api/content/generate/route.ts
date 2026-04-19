import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";

export const runtime = "nodejs";

type TemplateRow = {
  id: number;
  klant: string;
  platform: string;
  prompt: string;
};

function applyVars(prompt: string, vars: Record<string, unknown>): string {
  let out = prompt;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val ?? ""));
  }
  return out;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    template_id,
    klant = "fumero",
    platform,
    variabelen = {},
    custom_prompt,
  } = body as {
    template_id?: number;
    klant?: string;
    platform?: string;
    variabelen?: Record<string, unknown>;
    custom_prompt?: string;
  };

  let prompt: string | undefined =
    typeof custom_prompt === "string" && custom_prompt.trim()
      ? custom_prompt.trim()
      : undefined;

  let plat =
    typeof platform === "string" && platform ? platform : "instagram";

  if (!prompt && template_id != null) {
    const template = db
      .prepare("SELECT * FROM content_templates WHERE id = ? AND klant = ?")
      .get(template_id, String(klant)) as TemplateRow | undefined;
    if (!template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }
    if (!platform) {
      plat = template.platform;
    }
    prompt = applyVars(
      template.prompt,
      variabelen && typeof variabelen === "object" ? variabelen : {}
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { error: "custom_prompt or template_id required" },
      { status: 400 }
    );
  }

  const { ok, status, data, rawText } = await callFactoryN8n({
    prompt,
    klant: String(klant),
    afdeling: "content",
    type: "content_generate",
    platform: plat,
  });

  if (!ok) {
    return NextResponse.json(
      { error: `n8n error: ${status}`, detail: rawText.slice(0, 500) },
      { status: status >= 400 ? status : 502 }
    );
  }

  const content = extractMessage(data);

  const result = db
    .prepare(
      `INSERT INTO content_posts (klant, platform, type, content, status, source)
       VALUES (?,?,?,?, 'draft', 'ai')`
    )
    .run(String(klant), plat, "post", content);

  return NextResponse.json({
    id: result.lastInsertRowid,
    content,
    platform: plat,
  });
}
