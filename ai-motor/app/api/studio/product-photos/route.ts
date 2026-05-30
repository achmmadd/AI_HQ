import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Text-to-image naast Kontext (image+prompt). */
const FAL_MODEL = "fal-ai/flux/schnell";
const FAL_URL = `https://fal.run/${FAL_MODEL}`;

function falKey(): string | undefined {
  return (
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    undefined
  );
}

const STYLE_HINTS: Record<string, string> = {
  mockup:
    "clean e-commerce product mockup on neutral studio background, soft shadows",
  lifestyle:
    "natural lifestyle setting, tasteful context, professional commercial photo",
  minimal: "ultra minimal studio, single light source, high-end catalog style",
  premium:
    "premium Dutch retail aesthetic, subtle depth of field, no text overlays",
};

export async function POST(req: NextRequest) {
  const key = falKey();
  if (!key) {
    return NextResponse.json(
      { error: "FAL_API_KEY of FAL_KEY ontbreekt op de server." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const productName =
    typeof (body as { product_name?: string }).product_name === "string"
      ? (body as { product_name: string }).product_name.trim()
      : "";
  const styleRaw =
    typeof (body as { style?: string }).style === "string"
      ? (body as { style: string }).style.trim().toLowerCase()
      : "mockup";
  const style = STYLE_HINTS[styleRaw] ? styleRaw : "mockup";
  const countRaw = (body as { count?: unknown }).count;
  const count =
    typeof countRaw === "number" && Number.isFinite(countRaw)
      ? Math.min(4, Math.max(1, Math.floor(countRaw)))
      : 1;
  const extra =
    typeof (body as { extra_prompt?: string }).extra_prompt === "string"
      ? (body as { extra_prompt: string }).extra_prompt.trim()
      : "";

  if (!productName) {
    return NextResponse.json(
      { error: "product_name is verplicht." },
      { status: 400 }
    );
  }

  const styleLine = STYLE_HINTS[style] ?? STYLE_HINTS.mockup;
  const prompt = [
    "Photorealistic product photograph for webshop.",
    `Product: ${productName}.`,
    styleLine + ".",
    "Adults-only compliant framing where applicable; no illegal claims.",
    extra ? `Extra: ${extra}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await fetch(FAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        num_images: count,
        image_size: "square_hd",
      }),
      signal: AbortSignal.timeout(180_000),
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
    const urls = (out.images ?? [])
      .map((im) => (typeof im.url === "string" ? im.url : ""))
      .filter(Boolean);

    if (!urls.length) {
      return NextResponse.json(
        { error: "Geen afbeeldingen in fal-response", raw: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      model: FAL_MODEL,
      prompt,
      images: urls.map((url) => ({ url })),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
      },
      { status: 502 }
    );
  }
}
