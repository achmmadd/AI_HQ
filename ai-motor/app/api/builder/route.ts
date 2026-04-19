import { readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  extractAppCodeFromFactoryOutput,
  normalizeAppCodeForPreview,
  validateAppCode,
} from "@/lib/builder-code";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function getTemplate(): string {
  const templatePath = path.join(
    process.env.HOME || "/home/pietje",
    "AI_HQ/factory-os/prompts/app-builder-template.md"
  );
  try {
    return readFileSync(templatePath, "utf-8");
  } catch {
    return "";
  }
}

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

async function buildWithRetry(
  userPrompt: string,
  template: string,
  maxAttempts = 3
): Promise<{ code: string; attempts: number; error?: string }> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryHint =
      attempt > 1
        ? `\n\nVORIGE POGING MISLUKT: ${lastError}\nLos dit op: één volledig HTML-bestand met vanilla JS (geen React/JSX), geen import/export, geen markdown-fences.`
        : "";

    const fullPrompt = `${template}\n\n---\nBouw deze app: ${userPrompt}${retryHint}`;

    try {
      const { ok, status, data } = await callFactoryN8n({
        prompt: fullPrompt,
        klant: "system",
        afdeling: "fabriek",
        type: "app_build",
        parse_response: true,
        attempt,
      });

      if (!ok) {
        lastError = `Factory OS HTTP ${status}`;
        continue;
      }

      const text = extractMessage(data);
      let code = extractAppCodeFromFactoryOutput(text);
      code = code
        .replace(/```(?:jsx?|tsx?|javascript|react)?\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      code = normalizeAppCodeForPreview(code);

      const validation = validateAppCode(code);
      if (validation.valid) {
        return { code: validation.code, attempts: attempt };
      }
      lastError = validation.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    code: "",
    attempts: maxAttempts,
    error: `Mislukt na ${maxAttempts} pogingen: ${lastError}`,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const template = getTemplate();
  const naam = prompt.split(/\s+/).slice(0, 4).join(" ") || "Custom app";
  const slugBase = toSlugBase(prompt) || "app";
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3040";

  try {
    const { code, attempts, error } = await buildWithRetry(prompt, template);

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
      `App gebouwd: ${naam}${attempts > 1 ? ` (${attempts} pogingen)` : ""}\n${previewUrl}`
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
