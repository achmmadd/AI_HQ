import sharp from "sharp";
import type {
  BoundingBox,
  QualityCheckResult,
  QualityFormat,
  SafeZoneDefinition,
  SafeZoneMargins,
} from "@/lib/photo-studio/quality/types";

/** Meta placement safe-zone margins as fractions of width/height. */
const META_SAFE_ZONES: Record<QualityFormat, SafeZoneMargins> = {
  "1:1": { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
  "4:5": { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
  "9:16": { top: 0.14, bottom: 0.35, left: 0.05, right: 0.05 },
};

const FORMAT_ASPECT: Record<QualityFormat, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
};

function contentRectFromMargins(margins: SafeZoneMargins) {
  return {
    x: margins.left,
    y: margins.top,
    width: 1 - margins.left - margins.right,
    height: 1 - margins.top - margins.bottom,
  };
}

export function getSafeZone(format: QualityFormat): SafeZoneDefinition {
  const margins = META_SAFE_ZONES[format];
  return {
    format,
    margins,
    contentRect: contentRectFromMargins(margins),
  };
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

export function isWithinSafeZone(
  bbox: BoundingBox,
  format: QualityFormat,
  imageWidth: number,
  imageHeight: number
): boolean {
  const { contentRect } = getSafeZone(format);
  const px = bboxToPixels(bbox, imageWidth, imageHeight);

  const safeLeft = contentRect.x * imageWidth;
  const safeTop = contentRect.y * imageHeight;
  const safeRight = safeLeft + contentRect.width * imageWidth;
  const safeBottom = safeTop + contentRect.height * imageHeight;

  const bboxRight = px.x + px.width;
  const bboxBottom = px.y + px.height;

  return (
    px.x >= safeLeft &&
    px.y >= safeTop &&
    bboxRight <= safeRight &&
    bboxBottom <= safeBottom
  );
}

export async function generateSafeZoneOverlay(
  format: QualityFormat,
  width: number,
  height: number
): Promise<Buffer> {
  const { margins } = getSafeZone(format);
  const topH = Math.round(height * margins.top);
  const bottomH = Math.round(height * margins.bottom);
  const leftW = Math.round(width * margins.left);
  const rightW = Math.round(width * margins.right);
  const safeTop = topH;
  const safeLeft = leftW;
  const safeWidth = Math.max(1, width - leftW - rightW);
  const safeHeight = Math.max(1, height - topH - bottomH);

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(255,0,0,0.25)"/>
      <rect x="${safeLeft}" y="${safeTop}" width="${safeWidth}" height="${safeHeight}" fill="rgba(0,255,0,0.15)"/>
      <rect x="${safeLeft}" y="${safeTop}" width="${safeWidth}" height="${safeHeight}" fill="none" stroke="rgba(0,255,0,0.8)" stroke-width="2" stroke-dasharray="8 4"/>
    </svg>`);

  const base = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function checkSafeZone(
  imagePath: string,
  format: QualityFormat,
  productBbox?: BoundingBox
): Promise<QualityCheckResult> {
  const meta = await sharp(imagePath).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width === 0 || height === 0) {
    return {
      id: "S5",
      criterion: "Meta safe zone",
      status: "fail",
      message: "Kan afmetingen niet bepalen voor safe-zone check.",
    };
  }

  const actualAspect = width / height;
  const expectedAspect = FORMAT_ASPECT[format];
  const aspectDelta = Math.abs(actualAspect - expectedAspect);
  if (aspectDelta > 0.02) {
    return {
      id: "S5",
      criterion: "Meta safe zone",
      status: "warn",
      message: `Beeldverhouding ${actualAspect.toFixed(3)} wijkt af van ${format} (${expectedAspect.toFixed(3)}).`,
    };
  }

  if (!productBbox) {
    const { margins } = getSafeZone(format);
    return {
      id: "S5",
      criterion: "Meta safe zone",
      status: "pass",
      message: `Formaat ${format} OK. Safe zones: top ${(margins.top * 100).toFixed(0)}%, bottom ${(margins.bottom * 100).toFixed(0)}%. Geen productBbox — aspect-ratio alleen gecontroleerd.`,
    };
  }

  const inside = isWithinSafeZone(productBbox, format, width, height);
  return {
    id: "S5",
    criterion: "Meta safe zone",
    status: inside ? "pass" : "fail",
    message: inside
      ? `Product valt binnen Meta safe zone voor ${format}.`
      : `Product valt buiten Meta safe zone voor ${format}.`,
  };
}
