import type { FalGenerateResult, PhotoStudioMode } from "@/lib/photo-studio/types";

const TXT2IMG_MODEL = "fal-ai/flux/schnell";
const IMG2IMG_MODEL = "fal-ai/flux-kontext/dev";

function falKey(): string | undefined {
  return (
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    undefined
  );
}

const IMG2IMG_BASE_PROMPT =
  "Same product, better professional e-commerce photograph: improved lighting, sharper focus, " +
  "clean background, premium catalog quality, photorealistic, no text overlays.";

export async function generateWithFal(opts: {
  mode: PhotoStudioMode;
  prompt: string;
  image_url?: string;
  style_hint?: string;
  seed?: number;
}): Promise<FalGenerateResult> {
  const key = falKey();
  if (!key) {
    return { ok: false, error: "FAL_API_KEY of FAL_KEY ontbreekt op de server." };
  }

  const extra = opts.prompt.trim();
  const style = opts.style_hint?.trim();

  if (opts.mode === "text_to_image") {
    const fullPrompt = [
      "Photorealistic product photograph for webshop.",
      extra,
      style ? `Style: ${style}.` : "",
      "Adults-only compliant framing where applicable; no illegal claims.",
    ]
      .filter(Boolean)
      .join(" ");

    const body: Record<string, unknown> = {
      prompt: fullPrompt,
      num_images: 1,
      image_size: "square_hd",
    };
    if (opts.seed != null) body.seed = opts.seed;

    try {
      const res = await fetch(`https://fal.run/${TXT2IMG_MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });

      const parsed = await parseFalResponse(res);
      if (!parsed.ok) return parsed;
      const url = parsed.images[0];
      if (!url) return { ok: false, error: "Geen afbeelding in fal-response" };
      return { ok: true, url, prompt: fullPrompt, model: TXT2IMG_MODEL };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
      };
    }
  }

  const image_url = opts.image_url?.trim() ?? "";
  if (!image_url) {
    return { ok: false, error: "image_url is verplicht voor image-to-image." };
  }

  const kontextPrompt = [IMG2IMG_BASE_PROMPT, extra, style ? `Style: ${style}.` : ""]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await fetch(`https://fal.run/${IMG2IMG_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: kontextPrompt,
        image_url,
        num_images: 1,
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const parsed = await parseFalResponse(res);
    if (!parsed.ok) return parsed;
    const url = parsed.images[0];
    if (!url) return { ok: false, error: "Geen afbeelding in fal-response" };
    return { ok: true, url, prompt: kontextPrompt, model: IMG2IMG_MODEL };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fal.ai aanroep mislukt",
    };
  }
}

async function parseFalResponse(
  res: Response
): Promise<{ ok: true; images: string[] } | { ok: false; error: string }> {
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
  const images = (out.images ?? [])
    .map((im) => (typeof im.url === "string" ? im.url : ""))
    .filter(Boolean);
  return { ok: true, images };
}
