import sharp from "sharp";
import type { BoundingBox, QualityCheckResult } from "@/lib/photo-studio/quality/types";

const SSIM_PASS = 0.85;
const SSIM_FAIL = 0.75;
const K1 = 0.01;
const K2 = 0.03;
const L = 255;
const C1 = (K1 * L) ** 2;
const C2 = (K2 * L) ** 2;

async function loadGrayPixels(
  source: string | Buffer,
  width: number,
  height: number
): Promise<Float64Array> {
  const { data } = await sharp(source)
    .resize(width, height, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Float64Array(width * height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = data[i];
  return pixels;
}

function regionStats(
  pixels: Float64Array,
  width: number,
  x0: number,
  y0: number,
  regionW: number,
  regionH: number
): { mean: number; variance: number } {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = y0; y < y0 + regionH; y++) {
    const row = y * width;
    for (let x = x0; x < x0 + regionW; x++) {
      const v = pixels[row + x];
      sum += v;
      sumSq += v * v;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return { mean, variance: Math.max(0, variance) };
}

function regionCovariance(
  a: Float64Array,
  b: Float64Array,
  width: number,
  x0: number,
  y0: number,
  regionW: number,
  regionH: number,
  meanA: number,
  meanB: number
): number {
  let sum = 0;
  let count = 0;

  for (let y = y0; y < y0 + regionH; y++) {
    const row = y * width;
    for (let x = x0; x < x0 + regionW; x++) {
      const idx = row + x;
      sum += (a[idx] - meanA) * (b[idx] - meanB);
      count++;
    }
  }

  return sum / count;
}

function bboxToPixels(
  bbox: BoundingBox,
  imageWidth: number,
  imageHeight: number
): BoundingBox {
  const normalized =
    bbox.x <= 1 && bbox.y <= 1 && bbox.width <= 1 && bbox.height <= 1;
  if (!normalized) return bbox;
  return {
    x: Math.round(bbox.x * imageWidth),
    y: Math.round(bbox.y * imageHeight),
    width: Math.round(bbox.width * imageWidth),
    height: Math.round(bbox.height * imageHeight),
  };
}

/** Lightweight global SSIM over full image or masked bbox region. */
export async function computeSsim(
  inputPath: string,
  outputPath: string,
  productBbox?: BoundingBox
): Promise<number> {
  const inputMeta = await sharp(inputPath).metadata();
  const outputMeta = await sharp(outputPath).metadata();
  const width = Math.min(inputMeta.width ?? 0, outputMeta.width ?? 0);
  const height = Math.min(inputMeta.height ?? 0, outputMeta.height ?? 0);

  if (width === 0 || height === 0) return 0;

  const [inputPx, outputPx] = await Promise.all([
    loadGrayPixels(inputPath, width, height),
    loadGrayPixels(outputPath, width, height),
  ]);

  let x0 = 0;
  let y0 = 0;
  let regionW = width;
  let regionH = height;

  if (productBbox) {
    const px = bboxToPixels(productBbox, width, height);
    x0 = Math.max(0, Math.min(px.x, width - 1));
    y0 = Math.max(0, Math.min(px.y, height - 1));
    regionW = Math.max(1, Math.min(px.width, width - x0));
    regionH = Math.max(1, Math.min(px.height, height - y0));
  }

  const statsA = regionStats(inputPx, width, x0, y0, regionW, regionH);
  const statsB = regionStats(outputPx, width, x0, y0, regionW, regionH);
  const cov = regionCovariance(
    inputPx,
    outputPx,
    width,
    x0,
    y0,
    regionW,
    regionH,
    statsA.mean,
    statsB.mean
  );

  const numerator =
    (2 * statsA.mean * statsB.mean + C1) * (2 * cov + C2);
  const denominator =
    (statsA.mean ** 2 + statsB.mean ** 2 + C1) *
    (statsA.variance + statsB.variance + C2);

  if (denominator === 0) return 1;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export async function checkSsim(
  inputPath: string,
  outputPath: string,
  productBbox?: BoundingBox
): Promise<QualityCheckResult> {
  const score = await computeSsim(inputPath, outputPath, productBbox);

  let status: QualityCheckResult["status"];
  if (score >= SSIM_PASS) status = "pass";
  else if (score < SSIM_FAIL) status = "fail";
  else status = "warn";

  const maskNote = productBbox ? " (product mask)" : "";

  return {
    id: "T3",
    criterion: "SSIM fidelity",
    status,
    score,
    message: `SSIM ${score.toFixed(3)}${maskNote}. Pass ≥${SSIM_PASS}, fail <${SSIM_FAIL}.`,
  };
}
