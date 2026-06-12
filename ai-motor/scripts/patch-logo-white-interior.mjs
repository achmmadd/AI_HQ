#!/usr/bin/env node
/** Patch existing logo.png: solid white ghost body for dark UI backgrounds. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LOGO_PNG = path.join(ROOT, "public", "brands", "logo.png");
const LOGO_SVG = path.join(ROOT, "public", "brands", "logo.svg");

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

  let filled = 0;
  for (let i = 0; i < n; i++) {
    if (!isTransparent(i) || external[i]) continue;
    const p = i * 4;
    data[p] = 255;
    data[p + 1] = 255;
    data[p + 2] = 255;
    data[p + 3] = 255;
    filled++;
  }
  return filled;
}

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
  let changed = 0;
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
    changed++;
  }
  return changed;
}

const { data, info } = await sharp(LOGO_PNG)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const holesFilled = fillInteriorTransparentHoles(data, info.width, info.height);
const interiorWhitened = whitenGhostInterior(data, info.width, info.height);
const logoBuffer = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .toBuffer();

await fs.writeFile(LOGO_PNG, logoBuffer);

const logoBase64 = logoBuffer.toString("base64");
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${info.width} ${info.height}" role="img" aria-label="Fumero">
  <image xlink:href="data:image/png;base64,${logoBase64}" width="${info.width}" height="${info.height}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
await fs.writeFile(LOGO_SVG, svg);

console.log(
  `Logo patched (${info.width}x${info.height}): ${holesFilled} holes filled, ${interiorWhitened} interior pixels whitened`
);
