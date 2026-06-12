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

async function loadTrimmedLogo() {
  const meta = await sharp(LOGO_SRC).metadata();
  const base = meta.hasAlpha ? sharp(LOGO_SRC) : await stripDarkBackground(sharp(LOGO_SRC));
  return base.trim({ threshold: 12 }).png();
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
