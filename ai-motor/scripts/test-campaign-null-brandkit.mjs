#!/usr/bin/env node
/** Campaign generate with legacy/null brand kit fields (skip media). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSignedSessionToken } from "../lib/auth-session.ts";

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

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const token = await createSignedSessionToken({
  userId: 1,
  email: "test.fumero@motorsai.local",
  role: "fumero",
  scope: "fumero",
});
const headers = {
  Cookie: `motorsai_token=${token}`,
  "Content-Type": "application/json",
};

function fail(label, status, text) {
  console.error(`FAIL ${label}: HTTP ${status}`);
  console.error(text.slice(0, 800));
  process.exit(1);
}

const kitsRes = await fetch(`${base}/api/photo-studio/brand-kit?klant=fumero`, { headers });
const kitsText = await kitsRes.text();
if (!kitsRes.ok) fail("brand-kits", kitsRes.status, kitsText);

let kit;
try {
  const j = JSON.parse(kitsText);
  kit = j.items?.[0];
} catch {
  fail("brand-kits parse", kitsRes.status, kitsText);
}
if (!kit?.id) {
  console.error("No brand kit to patch");
  process.exit(1);
}

const patchRes = await fetch(`${base}/api/photo-studio/brand-kit/${kit.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({
    ...kit,
    product_name: null,
    name: kit.name || "Test Brand",
    description: kit.description ?? "",
  }),
});
const patchText = await patchRes.text();
if (!patchRes.ok) {
  console.warn("WARN: could not patch brand kit — using existing kit", patchRes.status, patchText.slice(0, 200));
}

const genRes = await fetch(`${base}/api/fumero/campaign/generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    brand_kit_id: kit.id,
    goal: "verkoop",
    skip_media: true,
  }),
  signal: AbortSignal.timeout(120_000),
});
const genText = await genRes.text();
console.log(`generate (null product_name, skip_media) → ${genRes.status}`);
if (!genRes.ok) fail("generate", genRes.status, genText);

const gen = JSON.parse(genText);
if (!gen.pack?.id || gen.pack.status !== "ready") {
  fail("generate body", 200, genText);
}
console.log("OK pack", gen.pack.id, "sku", gen.pack.sku, "copy sets", gen.pack.copy?.sets?.length);
