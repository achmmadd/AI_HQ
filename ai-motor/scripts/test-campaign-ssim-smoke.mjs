#!/usr/bin/env node
/** Quick FAL + SSIM smoke for one static creative. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBrandKit } from "../lib/photo-studio/brand-kit/storage.ts";
import { generateAdStrategy } from "../lib/photo-studio/campaign/ad-strategy.ts";
import { generateCampaignCreatives } from "../lib/photo-studio/campaign/creative.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

const kitId = process.argv[2] ?? "bk_1781204053455_k0ltd5";
const kit = getBrandKit(kitId, "fumero");
if (!kit) {
  console.error("Brand kit not found", kitId);
  process.exit(1);
}

const strategy = await generateAdStrategy(kit, "verkoop", { templateOnly: true });
const concept = strategy.concepts[0];
const packId = `cp_ssim_smoke_${Date.now()}`;

console.log("product image", kit.images.find((i) => i.role === "product")?.url);
const t0 = Date.now();
const assets = await generateCampaignCreatives({
  klant: kit.klant,
  packId,
  brandKit: kit,
  concept,
  goal: "verkoop",
  sku: "smoke",
  skipMedia: false,
});
console.log("elapsed", Date.now() - t0, "ms");

for (const a of assets) {
  console.log(a.format, "file", Boolean(a.file_path), "pass", a.quality_pass);
  const ssim = a.quality_checks.find((c) => c.id === "T3");
  if (ssim) console.log("  SSIM", ssim.status, ssim.score, ssim.message);
  const fal = a.quality_checks.find((c) => c.id === "fal" || c.id === "resolve");
  if (fal?.status === "fail") console.log("  FAIL", fal.message);
}

const ok = assets.some((a) => a.file_path && a.quality_checks.some((c) => c.id === "T3"));
process.exit(ok ? 0 : 1);
