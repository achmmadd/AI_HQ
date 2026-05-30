import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FAL_MODEL = "fal-ai/flux-kontext/dev";
const FAL_URL = `https://fal.run/${FAL_MODEL}`;

function falKey(): string | undefined {
  return (
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    undefined
  );
}

/**
 * fal.ai FLUX Kontext (dev) — image bewerking. Server-side key.
 * Body: { image_url: string (ook data-URI), prompt: string }
 */
export async function POST(req: NextRequest) {
  const key = falKey();
  if (!key) {
    return NextResponse.json(
      { error: "FAL_API_KEY of FAL_KEY ontbreekt op de server." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const image_url =
    typeof (body as { image_url?: string }).image_url === "string"
      ? (body as { image_url: string }).image_url.trim()
      : "";
  const prompt =
    typeof (body as { prompt?: string }).prompt === "string"
      ? (body as { prompt: string }).prompt.trim()
      : "";

  if (!image_url || !prompt) {
    return NextResponse.json(
      { error: "image_url en prompt zijn verplicht." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(FAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url,
        num_images: 1,
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json(
        { error: `fal.ai: ${res.status}`, detail: text.slice(0, 400) },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const errObj = data as { detail?: string; message?: string };
      return NextResponse.json(
        {
          error: errObj.detail || errObj.message || `fal HTTP ${res.status}`,
        },
        { status: 502 }
      );
    }

    const out = data as {
      images?: Array<{ url?: string; width?: number; height?: number }>;
    };
    const first = out.images?.[0];
    if (!first?.url) {
      return NextResponse.json(
        { error: "Geen image-URL in fal-response", raw: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: first.url,
      width: first.width,
      height: first.height,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fal.ai aanroep mislukt" },
      { status: 502 }
    );
  }
}
