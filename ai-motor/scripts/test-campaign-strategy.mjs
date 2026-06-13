#!/usr/bin/env node
/** Smoke: campaign strategy LLM vs template fallback. */
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

const kitsRes = await fetch(`${base}/api/photo-studio/brand-kit?klant=fumero`, { headers });
const kits = await kitsRes.json();
const brandKitId =
  kits.items?.find((k) => k.status === "confirmed")?.id ?? kits.items?.[0]?.id;
if (!brandKitId) {
  console.error("No brand kit");
  process.exit(1);
}

const t0 = Date.now();
const stratRes = await fetch(`${base}/api/fumero/campaign/strategy`, {
  method: "POST",
  headers,
  body: JSON.stringify({ brand_kit_id: brandKitId, goal: "verkoop" }),
  signal: AbortSignal.timeout(35_000),
});
const strat = await stratRes.json();
const elapsed = Date.now() - t0;

console.log("strategy HTTP", stratRes.status, "elapsed", elapsed, "ms");
console.log("source", strat.strategy?.source);
console.log(
  "concepts",
  strat.strategy?.concepts?.map((c) => `${c.angle}: ${c.hook.slice(0, 50)}`)
);
console.log("template_only config", strat.config?.template_only);

if (!strat.strategy?.concepts?.length) {
  console.error("FAIL: no concepts");
  process.exit(1);
}
if (elapsed > 30_000) {
  console.warn("WARN: strategy exceeded 30s");
}
console.log("OK strategy smoke");
