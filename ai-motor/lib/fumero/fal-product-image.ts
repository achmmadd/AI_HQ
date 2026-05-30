const FAL_MODEL = "fal-ai/flux/schnell";
const FAL_URL = `https://fal.run/${FAL_MODEL}`;

const STYLE_HINTS: Record<string, string> = {
  product_photo:
    "premium e-commerce product photography, clean studio or tasteful lifestyle setting, " +
    "soft diffused light, gentle natural shadows, shallow depth of field, sharp product in focus, " +
    "high detail, color-accurate, crisp, professional commercial look",
  banner:
    "modern webshop promotional banner, balanced composition with clear negative space for a headline, " +
    "contemporary Dutch retail aesthetic, premium lighting, vibrant yet tasteful, " +
    "no embedded text or logos unless explicitly requested",
  mockup:
    "clean e-commerce product mockup on neutral studio background, soft shadows, even lighting",
};

const QUALITY_SUFFIX =
  "High resolution, photorealistic, sharp focus, professional color grading, no watermark, no text artifacts.";

function falKey(): string | undefined {
  return (
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    undefined
  );
}

export async function generateFumeroProductImage(opts: {
  prompt: string;
  contentType: string;
  extra?: string;
}): Promise<{ ok: true; url: string; prompt: string } | { ok: false; error: string }> {
  const key = falKey();
  if (!key) {
    return {
      ok: false,
      error: "FAL_API_KEY ontbreekt — productfoto's/banners vereisen fal.ai.",
    };
  }

  const styleKey =
    opts.contentType === "banner" ? "banner" : "product_photo";
  const styleLine = STYLE_HINTS[styleKey] ?? STYLE_HINTS.product_photo;
  const fullPrompt = [
    "Photorealistic image for the fumero.nl premium webshop.",
    styleLine + ".",
    opts.prompt.trim(),
    opts.extra?.trim() ? `Extra: ${opts.extra.trim()}` : "",
    QUALITY_SUFFIX,
    "Adults-only compliant; no illegal claims.",
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
        prompt: fullPrompt,
        num_images: 1,
        image_size: opts.contentType === "banner" ? "landscape_16_9" : "square_hd",
      }),
      signal: AbortSignal.timeout(180_000),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, error: `fal.ai: ${res.status} — ${text.slice(0, 200)}` };
    }

    if (!res.ok) {
      const errObj = data as { detail?: string; message?: string };
      return {
        ok: false,
        error: errObj.detail || errObj.message || `fal HTTP ${res.status}`,
      };
    }

    const out = data as { images?: Array<{ url?: string }> };
    const url = out.images?.[0]?.url;
    if (!url) return { ok: false, error: "Geen afbeelding in fal-response" };
    return { ok: true, url, prompt: fullPrompt };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
    };
  }
}
