#!/usr/bin/env node
/** E2E with media enabled (async job path when FAL_KEY present). */
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

async function pollJob(jobId, maxMs = 600_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const res = await fetch(`${base}/api/fumero/campaign/jobs/${encodeURIComponent(jobId)}`, {
      headers,
    });
    const job = await res.json();
    console.log(`  poll → ${job.status} phase=${job.phase ?? "-"} ${(job.progressMessage ?? "").slice(0, 50)}`);
    if (job.status === "done") return job;
    if (job.status === "error") {
      if (job.partial && job.pack) return job;
      throw new Error(job.error ?? "job error");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("job timeout");
}

const kits = await fetch(`${base}/api/photo-studio/brand-kit?klant=fumero`, { headers }).then((r) =>
  r.json()
);
const brandKitId = kits.items?.find((k) => k.status === "confirmed")?.id;
if (!brandKitId) {
  console.error("No confirmed brand kit");
  process.exit(1);
}

console.log("media E2E brand_kit", brandKitId);
const t0 = Date.now();
const genRes = await fetch(`${base}/api/fumero/campaign/generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({ brand_kit_id: brandKitId, goal: "verkoop", skip_media: false }),
});
const genText = await genRes.text();
console.log("generate status", genRes.status, "elapsed", Date.now() - t0);

let pack;
if (genRes.status === 202) {
  const start = JSON.parse(genText);
  console.log("async job", start.job_id);
  const job = await pollJob(start.job_id);
  pack = job.pack ?? job.result?.pack;
} else if (genRes.ok) {
  pack = JSON.parse(genText).pack;
} else {
  console.error(genText.slice(0, 800));
  process.exit(1);
}

const staticWithFiles = pack?.static_assets?.filter((a) => a.file_path)?.length ?? 0;
const ssimChecks =
  pack?.static_assets?.flatMap((a) => a.quality_checks?.filter((c) => c.id === "T3") ?? []) ?? [];
console.log("pack", pack?.id, "status", pack?.status);
console.log("static files", staticWithFiles, "ssim checks", ssimChecks.length);
console.log("warnings", pack?.errors?.slice(0, 5));
if (pack?.zip_path) {
  const dl = await fetch(`${base}/api/fumero/campaign/${pack.id}/download`, { headers });
  console.log("download", dl.status);
}
console.log(staticWithFiles > 0 ? "OK media E2E" : "WARN no static files generated");
