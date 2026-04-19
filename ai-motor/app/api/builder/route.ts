import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  assertDifyConfigured,
  generateArtifactHtml,
} from "@/lib/artifact-html";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function toSlugBase(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 4).join(" ");
  return words
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";
  const afdeling =
    typeof body?.afdeling === "string" && body.afdeling
      ? body.afdeling
      : "fabriek";

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  if (!assertDifyConfigured()) {
    return NextResponse.json(
      { error: "Server misconfigured: DIFY_CODE_INTERPRETER_API_KEY missing" },
      { status: 500 }
    );
  }

  const naam = prompt.split(/\s+/).slice(0, 4).join(" ") || "Custom app";
  const slugBase = toSlugBase(prompt) || "app";
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3040";

  try {
    const { html: code, attempts, error } = await generateArtifactHtml(
      prompt,
      klant,
      afdeling
    );

    if (!code || error) {
      void sendTelegramMessage(`Builder mislukt\n${prompt}\n${error ?? ""}`);
      return NextResponse.json({ error: error ?? "build failed" }, { status: 500 });
    }

    const result = db
      .prepare(
        `INSERT INTO custom_apps (naam, slug, code, klant)
         VALUES (?,?,?,?)`
      )
      .run(naam, slug, code, klant);

    const id = Number(result.lastInsertRowid);
    const previewUrl = `${appBase}/apps/${slug}`;

    void sendTelegramMessage(
      `App gebouwd (Dify): ${naam}${attempts > 1 ? ` (${attempts} pogingen)` : ""}\n${previewUrl}`
    );

    return NextResponse.json({
      id,
      naam,
      slug,
      url: `/apps/${slug}`,
      preview_url: previewUrl,
      attempts,
      code_preview: code.length > 200 ? `${code.slice(0, 200)}…` : code,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    void sendTelegramMessage(`Builder crash: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
