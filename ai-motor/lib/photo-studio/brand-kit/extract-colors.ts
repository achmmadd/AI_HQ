import sharp from "sharp";

export type ExtractedColor = {
  hex: string;
  ratio: number;
};

const SAMPLE_SIZE = 64;
const MIN_RATIO = 0.04;

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Extract dominant colors from an image URL (best-effort, <5s). */
export async function extractColorsFromImageUrl(
  imageUrl: string,
  opts?: { maxColors?: number; timeoutMs?: number }
): Promise<ExtractedColor[]> {
  const maxColors = opts?.maxColors ?? 5;
  const timeoutMs = opts?.timeoutMs ?? 8000;

  const res = await fetch(imageUrl, {
    headers: { Accept: "image/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return [];

  const buffer = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<string, number>();
  const step = 24;
  const channels = info.channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const qr = quantize(r, step);
    const qg = quantize(g, step);
    const qb = quantize(b, step);
    const hex = rgbToHex(qr, qg, qb);
    buckets.set(hex, (buckets.get(hex) ?? 0) + 1);
  }

  const total = Array.from(buckets.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(buckets.entries())
    .map(([hex, count]) => ({ hex, ratio: count / total }))
    .filter((c) => c.ratio >= MIN_RATIO)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, maxColors);
}
