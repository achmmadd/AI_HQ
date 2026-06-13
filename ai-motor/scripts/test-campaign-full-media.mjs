#!/usr/bin/env node
/**
 * Stap 8 beta prep: full pack with media, poll async job, verify ZIP incl. meta JSON.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
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
    console.log(
      `  poll → ${job.status} phase=${job.phase ?? "-"} ${(job.progress_message ?? job.progressMessage ?? "").slice(0, 60)}`
    );
    if (job.status === "done") return job;
    if (job.status === "error") {
      if (job.partial && job.pack) return job;
      throw new Error(job.error ?? "job error");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("job timeout");
}

function assertZipContents(zip, pack) {
  const names = Object.keys(zip.files).filter((n) => !n.endsWith("/"));
  console.log("ZIP entries", names.length, names.slice(0, 12).join(", "), names.length > 12 ? "…" : "");

  const required = ["copy.csv", "README.md", "meta/asset_feed_spec.json"];
  for (const file of required) {
    if (!zip.file(file)) {
      throw new Error(`ZIP missing required file: ${file}`);
    }
  }

  const metaRaw = await zip.file("meta/asset_feed_spec.json")?.async("string");
  if (!metaRaw) throw new Error("meta/asset_feed_spec.json empty");
  const spec = JSON.parse(metaRaw);
  if (!Array.isArray(spec.titles) || spec.titles.length < 1) {
    throw new Error("asset_feed_spec.json: titles missing");
  }
  if (!Array.isArray(spec.bodies) || spec.bodies.length < 1) {
    throw new Error("asset_feed_spec.json: bodies missing");
  }
  if (!Array.isArray(spec.call_to_action_types) || spec.call_to_action_types.length < 1) {
    throw new Error("asset_feed_spec.json: call_to_action_types missing");
  }
  console.log(
    "meta spec",
    `titles=${spec.titles.length}`,
    `images=${spec.images?.length ?? 0}`,
    `videos=${spec.videos?.length ?? 0}`,
    `ctas=${spec.call_to_action_types.join(",")}`
  );

  const staticFiles = names.filter((n) => n.startsWith("static/") && !n.endsWith("/"));
  console.log("static in ZIP", staticFiles.length);
  if (staticFiles.length < 1 && pack?.static_assets?.some((a) => a.file_path)) {
    throw new Error("ZIP has no static/ files but pack reports static assets");
  }
}

const kits = await fetch(`${base}/api/photo-studio/brand-kit?klant=fumero`, { headers }).then((r) =>
  r.json()
);
const brandKitId = kits.items?.find((k) => k.status === "confirmed")?.id;
if (!brandKitId) {
  console.error("No confirmed brand kit");
  process.exit(1);
}

console.log("full-media E2E brand_kit", brandKitId);
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
  console.log("async job", start.job_id ?? start.jobId);
  const job = await pollJob(start.job_id ?? start.jobId);
  pack = job.pack ?? job.result?.pack;
} else if (genRes.ok) {
  pack = JSON.parse(genText).pack;
} else {
  console.error(genText.slice(0, 800));
  process.exit(1);
}

const staticWithFiles = pack?.static_assets?.filter((a) => a.file_path)?.length ?? 0;
console.log("pack", pack?.id, "status", pack?.status);
console.log("static files", staticWithFiles);
console.log("strategy source", pack?.strategy?.source);
console.log("warnings", pack?.errors?.slice(0, 5));

if (!pack?.zip_path && !pack?.id) {
  console.error("FAIL: no pack");
  process.exit(1);
}

const dl = await fetch(`${base}/api/fumero/campaign/${pack.id}/download`, { headers });
console.log("download", dl.status);
if (!dl.ok) {
  console.error("download failed", await dl.text().then((t) => t.slice(0, 300)));
  process.exit(1);
}

const zipBuf = Buffer.from(await dl.arrayBuffer());
const zip = await JSZip.loadAsync(zipBuf);
assertZipContents(zip, pack);

console.log(staticWithFiles > 0 ? "OK full-media E2E + meta ZIP" : "WARN no static files (FAL?)");
