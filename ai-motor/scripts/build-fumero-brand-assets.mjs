/**
 * Build brand assets from the single logo source PNG.
 * Run: node scripts/build-fumero-brand-assets.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BRANDS = path.join(ROOT, "public", "brands");
const ICONS = path.join(ROOT, "public", "icons");

const LOGO_SRC =
  process.env.FUMERO_LOGO_SRC ??
  path.join(__dirname, "brand-assets", "fumero-mascot-source.png");

/** Single canonical logo asset basename */
const LOGO_BASENAME = "logo";
const BRAND_GREEN = "#69C400";
const BRAND_BG = "#0c0c0e";

async function ensureDirs() {
  await fs.mkdir(BRANDS, { recursive: true });
  await fs.mkdir(ICONS, { recursive: true });
}

/** Strip near-black backgrounds from sources that ship without alpha. */
async function stripDarkBackground(input) {
  const { data, info } = await input
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 32 && g < 32 && b < 32) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

/**
 * Ghost mascot PNGs often have a hollow body (transparent interior).
 * On dark UI that reads as black — fill enclosed holes with solid white.
 */
function fillInteriorTransparentHoles(data, width, height) {
  const n = width * height;
  const external = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const isTransparent = (idx) => data[idx * 4 + 3] < 20;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (external[i] || !isTransparent(i)) return;
    external[i] = 1;
    queue[tail++] = i;
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  for (let i = 0; i < n; i++) {
    if (!isTransparent(i) || external[i]) continue;
    const p = i * 4;
    data[p] = 255;
    data[p + 1] = 255;
    data[p + 2] = 255;
    data[p + 3] = 255;
  }
}

/** Pixels near the outer silhouette keep outline strokes; interior becomes solid white. */
function isNearTransparentEdge(data, width, height, idx, radius = 3) {
  const x = idx % width;
  const y = (idx / width) | 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (data[(ny * width + nx) * 4 + 3] < 20) return true;
    }
  }
  return false;
}

function isGreenAccentPixel(data, p) {
  return data[p + 3] > 128 && data[p + 1] > 85 && data[p] < 170 && data[p + 2] < 130;
}

function whitenGhostInterior(data, width, height) {
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (data[p + 3] < 128) continue;
    if (isGreenAccentPixel(data, p)) continue;
    if (isNearTransparentEdge(data, width, height, i)) continue;
    const max = Math.max(data[p], data[p + 1], data[p + 2]);
    if (max > 245) continue;
    data[p] = 255;
    data[p + 1] = 255;
    data[p + 2] = 255;
  }
}

async function normalizeLogoPixels(input) {
  const { data, info } = await input
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  fillInteriorTransparentHoles(data, info.width, info.height);
  whitenGhostInterior(data, info.width, info.height);
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

async function fillLogoInteriorHoles(input) {
  return normalizeLogoPixels(input);
}

async function loadTrimmedLogo() {
  const meta = await sharp(LOGO_SRC).metadata();
  const base = meta.hasAlpha ? sharp(LOGO_SRC) : await stripDarkBackground(sharp(LOGO_SRC));
  const trimmed = base.trim({ threshold: 12 }).png();
  return fillLogoInteriorHoles(trimmed);
}

async function writeLogoAssets(logo) {
  const logoBuffer = await logo.clone().png().toBuffer();
  const meta = await sharp(logoBuffer).metadata();
  const width = meta.width ?? 692;
  const height = meta.height ?? 795;

  await fs.writeFile(path.join(BRANDS, `${LOGO_BASENAME}.png`), logoBuffer);

  const logoBase64 = logoBuffer.toString("base64");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" role="img" aria-label="Fumero">
  <image xlink:href="data:image/png;base64,${logoBase64}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  await fs.writeFile(path.join(BRANDS, `${LOGO_BASENAME}.svg`), svg);

  return { logoBuffer, logoBase64, width, height };
}

async function buildIcons(logoBuffer) {
  const sizes = [
    { name: "favicon.png", size: 32 },
    { name: "icon-16.png", size: 16 },
    { name: "icon-32.png", size: 32 },
    { name: "icon-48.png", size: 48 },
    { name: "icon-180.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    const out = await sharp(logoBuffer)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(BRANDS, name), out);
    if (name === "icon-192.png" || name === "icon-512.png") {
      await fs.writeFile(path.join(ICONS, name), out);
    }
  }

  await fs.copyFile(path.join(BRANDS, "favicon.png"), path.join(ROOT, "public", "favicon.ico"));
  await fs.copyFile(path.join(BRANDS, "favicon.png"), path.join(ROOT, "public", "favicon-fumero.png"));
}

async function buildOgImage(logoBase64, width, height) {
  const canvasW = 1200;
  const canvasH = 630;
  const logoH = 480;
  const logoW = Math.round((width / height) * logoH);
  const logoX = Math.round((canvasW - logoW) / 2);
  const logoY = Math.round((canvasH - logoH) / 2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <rect width="${canvasW}" height="${canvasH}" fill="${BRAND_BG}"/>
  <image xlink:href="data:image/png;base64,${logoBase64}" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${canvasW / 2}" y="${logoY + logoH + 48}" fill="${BRAND_GREEN}" font-family="system-ui, sans-serif" font-size="28" font-weight="600" text-anchor="middle" letter-spacing="2">FUMERO</text>
</svg>`;

  const og = await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(BRANDS, "og.png"), og);
}

async function removeLegacyAssets() {
  const legacy = [
    "fumero-logo.png",
    "fumero-logo.svg",
    "fumero-logo-compact.png",
    "smokey-mascot.png",
    "smokey-mascot.svg",
    "fumero-spook-website.png",
    "fumero-spook-website.svg",
    "fumero_spook_website(1).svg",
    "fumero-favicon.png",
    "fumero-icon-16.png",
    "fumero-icon-32.png",
    "fumero-icon-48.png",
    "fumero-icon-180.png",
    "fumero-icon-192.png",
    "fumero-icon-512.png",
    "fumero-og.png",
  ];
  for (const name of legacy) {
    try {
      await fs.unlink(path.join(BRANDS, name));
    } catch {
      /* already removed */
    }
  }
}

async function main() {
  await ensureDirs();
  const logo = await loadTrimmedLogo();
  const { logoBuffer, logoBase64, width, height } = await writeLogoAssets(logo);
  await buildIcons(logoBuffer);
  await buildOgImage(logoBase64, width, height);
  await removeLegacyAssets();

  console.log(JSON.stringify({ width, height, svg: `/brands/${LOGO_BASENAME}.svg` }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
