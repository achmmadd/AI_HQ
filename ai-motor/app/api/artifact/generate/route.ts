import { NextRequest, NextResponse } from "next/server";
import { generateArtifactHtml, assertDifyConfigured } from "@/lib/artifact-html";
import { isBuildLikePrompt } from "@/lib/build-intent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
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

  if (!isBuildLikePrompt(prompt)) {
    return NextResponse.json(
      { error: "prompt lijkt geen app-build (gebruik woorden als ‘maak’ of ‘bouw’)." },
      { status: 400 }
    );
  }

  if (!assertDifyConfigured()) {
    return NextResponse.json(
      { error: "Dify API key niet geconfigureerd" },
      { status: 500 }
    );
  }

  const { html, attempts, error } = await generateArtifactHtml(
    prompt,
    klant,
    afdeling
  );

  if (!html || error) {
    return NextResponse.json(
      { error: error ?? "artifact build failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    html,
    title: prompt.split(/\s+/).slice(0, 6).join(" ") || "App",
    attempts,
  });
}
