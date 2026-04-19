import { NextRequest, NextResponse } from "next/server";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const klant = typeof body?.klant === "string" ? body.klant : "system";
  const afdeling =
    typeof body?.afdeling === "string" ? body.afdeling : "fabriek";

  if (!prompt.trim()) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  try {
    const { ok, status, data } = await callFactoryN8n({
      prompt: prompt.trim(),
      klant,
      afdeling,
      type: "app_build",
      parse_response: true,
    });

    if (!ok) {
      return NextResponse.json(
        { error: `Factory OS error: ${status}` },
        { status: 502 }
      );
    }

    const responseText = extractMessage(data);
    const features = data.features;
    const featureList = Array.isArray(features)
      ? features.filter((x): x is string => typeof x === "string")
      : [];

    return NextResponse.json({
      appName:
        typeof data.appName === "string" ? data.appName : "Custom App",
      description:
        typeof data.description === "string" ? data.description : prompt,
      features: featureList,
      apiRoute: `/api/custom-${Date.now()}`,
      response: responseText,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
