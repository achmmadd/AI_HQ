#!/usr/bin/env node
/** E2E smoke: campaign strategy → async/sync generate → job poll → download. */
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
  console.error(text.slice(0, 600));
  process.exit(1);
}

async function pollJob(jobId, maxMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const res = await fetch(`${base}/api/fumero/campaign/jobs/${encodeURIComponent(jobId)}`, {
      headers,
    });
    const text = await res.text();
    if (!res.ok) fail("job poll", res.status, text);
    const job = JSON.parse(text);
    console.log(`  poll → ${job.status} phase=${job.phase ?? "-"} msg=${(job.progress_message ?? "").slice(0, 60)}`);
    if (job.status === "done") return job;
    if (job.status === "error") {
      if (job.partial && job.pack) return job;
      fail("job error", 200, text);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  fail("job timeout", 0, "poll exceeded max wait");
}

console.log("BASE", base);
console.log("CAMPAIGN_TEMPLATE_ONLY", process.env.CAMPAIGN_TEMPLATE_ONLY ?? "(unset)");

const kitsRes = await fetch(`${base}/api/photo-studio/brand-kit?klant=fumero`, { headers });
const kitsText = await kitsRes.text();
if (!kitsRes.ok) fail("brand-kits", kitsRes.status, kitsText);

let brandKitId;
try {
  const j = JSON.parse(kitsText);
  brandKitId = j.items?.[0]?.id;
} catch {
  fail("brand-kits parse", kitsRes.status, kitsText);
}

if (!brandKitId) {
  console.log("No brand kits — create one at /fumero/campaign-studio");
  process.exit(1);
}
console.log("brand_kit_id", brandKitId);

const stratRes = await fetch(`${base}/api/fumero/campaign/strategy`, {
  method: "POST",
  headers,
  body: JSON.stringify({ brand_kit_id: brandKitId, goal: "verkoop" }),
  signal: AbortSignal.timeout(35_000),
});
const stratText = await stratRes.text();
if (!stratRes.ok) fail("strategy", stratRes.status, stratText);
const strat = JSON.parse(stratText);
if (!strat.strategy?.concepts?.length) fail("strategy body", 200, stratText);

const t1 = Date.now();
const genRes = await fetch(`${base}/api/fumero/campaign/generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    brand_kit_id: brandKitId,
    goal: "verkoop",
    skip_media: true,
    strategy: strat.strategy,
  }),
  signal: AbortSignal.timeout(120_000),
});
const genElapsed = Date.now() - t1;
const genText = await genRes.text();
console.log(`generate → ${genRes.status} (${genElapsed}ms)`);

let pack;
if (genRes.status === 202) {
  const start = JSON.parse(genText);
  if (!start.job_id) fail("async start", genRes.status, genText);
  console.log("async job", start.job_id);
  const job = await pollJob(start.job_id);
  pack = job.pack;
} else if (genRes.ok) {
  const gen = JSON.parse(genText);
  pack = gen.pack;
} else {
  fail("generate", genRes.status, genText);
}

if (!pack?.id) fail("generate body", 200, genText);
console.log("pack", pack.id, "status", pack.status, "copy sets", pack.copy?.sets?.length);

if (pack.zip_path) {
  const dlRes = await fetch(`${base}/api/fumero/campaign/${pack.id}/download`, { headers });
  console.log(`download → ${dlRes.status}`);
  if (!dlRes.ok) fail("download", dlRes.status, await dlRes.text());
}

console.log("OK campaign flow complete");
