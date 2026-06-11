/**
 * Build Fumero brand assets from the source mascot PNG.
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

const MASCOT_SRC =
  process.env.FUMERO_MASCOT_SRC ??
  path.join(__dirname, "brand-assets", "fumero-mascot-source.png");

const GEIST_BOLD = path.join(
  ROOT,
  "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf"
);
const GEIST_SEMIBOLD = path.join(
  ROOT,
  "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf"
);

const BRAND_GREEN = "#78BE00";
const BRAND_GREEN_UI = "#69C400";

/** Reference full logo (1024×344) layout ratios. */
const REF = {
  mascotX: 22,
  mascotHeightRatio: 297 / 344,
  textGap: 39,
  fumeroBaseline: 190,
  taglineBaseline: 262,
  fumeroSize: 120,
  taglineSize: 36,
  taglineTracking: 0.32,
};

async function ensureDirs() {
  await fs.mkdir(BRANDS, { recursive: true });
  await fs.mkdir(ICONS, { recursive: true });
}

async function loadFontBase64(fontPath) {
  return (await fs.readFile(fontPath)).toString("base64");
}

async function loadTrimmedMascot() {
  return sharp(MASCOT_SRC).trim({ threshold: 10 }).png();
}

async function trimWithPadding(input, padding = 16) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return sharp(input);
  }

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(w - 1, maxX + padding);
  const bottom = Math.min(h - 1, maxY + padding);

  return sharp(input).extract({
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  });
}

function fontFaceCss(name, base64) {
  return `@font-face{font-family:'${name}';src:url('data:font/ttf;base64,${base64}') format('truetype');font-weight:700;font-style:normal;}`;
}

async function writeMascotAssets(mascot) {
  const mascotBuffer = await mascot.clone().png().toBuffer();
  const meta = await sharp(mascotBuffer).metadata();
  await fs.writeFile(path.join(BRANDS, "smokey-mascot.png"), mascotBuffer);

  const mascotBase64 = mascotBuffer.toString("base64");
  const mascotSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${meta.width} ${meta.height}" role="img" aria-label="Fumero mascot Smokey">
  <image href="data:image/png;base64,${mascotBase64}" width="${meta.width}" height="${meta.height}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
  await fs.writeFile(path.join(BRANDS, "smokey-mascot.svg"), mascotSvg);

  return { mascotBuffer, mascotBase64, meta };
}

async function buildFullLogo(mascotBase64, mascotMeta, fonts) {
  const scale = 2;
  const canvasH = 344 * scale;
  const mascotH = Math.round(canvasH * REF.mascotHeightRatio);
  const mascotW = Math.round((mascotMeta.width / mascotMeta.height) * mascotH);
  const mascotX = REF.mascotX * scale;
  const mascotY = Math.round((canvasH - mascotH) / 2);
  const textX = mascotX + mascotW + REF.textGap * scale;
  const canvasW = textX + 1100;

  const fumeroSize = REF.fumeroSize * scale;
  const taglineSize = REF.taglineSize * scale;
  const taglineTracking = REF.taglineTracking * taglineSize;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}" role="img" aria-label="Fumero Vapes and More">
  <defs>
    <style>
      ${fontFaceCss("GeistBold", fonts.bold)}
      ${fontFaceCss("GeistSemiBold", fonts.semiBold)}
    </style>
  </defs>
  <image href="data:image/png;base64,${mascotBase64}" x="${mascotX}" y="${mascotY}" width="${mascotW}" height="${mascotH}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${textX}" y="${REF.fumeroBaseline * scale}" fill="${BRAND_GREEN}" font-family="GeistBold, sans-serif" font-size="${fumeroSize}" letter-spacing="1">FUMERO</text>
  <text x="${textX}" y="${REF.taglineBaseline * scale}" fill="${BRAND_GREEN}" font-family="GeistSemiBold, sans-serif" font-size="${taglineSize}" letter-spacing="${taglineTracking.toFixed(1)}">VAPES &amp; MORE</text>
</svg>`;

  const fullSvgPath = path.join(BRANDS, "fumero-logo.svg");
  await fs.writeFile(fullSvgPath, svg);

  const fullPngRaw = await sharp(Buffer.from(svg)).png().toBuffer();
  const trimmed = await trimWithPadding(fullPngRaw, 28);
  const fullPng = await trimmed.png().toBuffer();
  await fs.writeFile(path.join(BRANDS, "fumero-logo.png"), fullPng);

  const meta = await sharp(fullPng).metadata();
  const compactPng = await sharp(fullPng)
    .resize(1024, null, { fit: "inside" })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(BRANDS, "fumero-logo-compact.png"), compactPng);

  return meta;
}

async function buildIcons(mascotBuffer) {
  const sizes = [
    { name: "fumero-icon-16.png", size: 16 },
    { name: "fumero-icon-32.png", size: 32 },
    { name: "fumero-icon-48.png", size: 48 },
    { name: "fumero-icon-180.png", size: 180 },
    { name: "fumero-icon-192.png", size: 192 },
    { name: "fumero-icon-512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    const out = await sharp(mascotBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(BRANDS, name), out);
    if (name.endsWith("192.png") || name.endsWith("512.png")) {
      await fs.writeFile(path.join(ICONS, name.replace("fumero-", "")), out);
    }
  }

  const favicon32 = path.join(BRANDS, "fumero-icon-32.png");
  await fs.copyFile(favicon32, path.join(BRANDS, "fumero-favicon.png"));
  await fs.copyFile(favicon32, path.join(ROOT, "public", "favicon-fumero.png"));
}

async function buildOgImage(mascotBase64, mascotMeta, fonts) {
  const w = 1200;
  const h = 630;
  const mascotH = 400;
  const mascotW = Math.round((mascotMeta.width / mascotMeta.height) * mascotH);
  const mascotX = 72;
  const mascotY = Math.round((h - mascotH) / 2);
  const textX = mascotX + mascotW + 40;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <style>
      ${fontFaceCss("GeistBold", fonts.bold)}
      ${fontFaceCss("GeistSemiBold", fonts.semiBold)}
    </style>
  </defs>
  <rect width="${w}" height="${h}" fill="#0c0c0e"/>
  <image href="data:image/png;base64,${mascotBase64}" x="${mascotX}" y="${mascotY}" width="${mascotW}" height="${mascotH}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${textX}" y="290" fill="${BRAND_GREEN_UI}" font-family="GeistBold, sans-serif" font-size="128" letter-spacing="1">FUMERO</text>
  <text x="${textX}" y="360" fill="${BRAND_GREEN_UI}" font-family="GeistSemiBold, sans-serif" font-size="38" letter-spacing="10">VAPES &amp; MORE</text>
  <text x="${textX}" y="430" fill="#8b8b8f" font-family="GeistSemiBold, sans-serif" font-size="26" letter-spacing="0.5">Studio · Chat · Shop operations</text>
</svg>`;

  const og = await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(BRANDS, "fumero-og.png"), og);
}

async function main() {
  await ensureDirs();
  const fonts = {
    bold: await loadFontBase64(GEIST_BOLD),
    semiBold: await loadFontBase64(GEIST_SEMIBOLD),
  };

  const mascot = await loadTrimmedMascot();
  const { mascotBuffer, mascotBase64, meta } = await writeMascotAssets(mascot);
  const fullMeta = await buildFullLogo(mascotBase64, meta, fonts);
  await buildIcons(mascotBuffer);
  await buildOgImage(mascotBase64, meta, fonts);

  console.log("Fumero brand assets written to public/brands/");
  console.log("Full logo dimensions:", { width: fullMeta.width, height: fullMeta.height });
  console.log("Mascot dimensions:", { width: meta.width, height: meta.height });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
