#!/usr/bin/env -S node --import tsx
/**
 * Live eval: async Builder v2 chunked flow (202 → poll → done → preview checks).
 *
 *   node --import tsx scripts/eval-builder-v2-chunked.mjs [port]
 *   BASE=http://127.0.0.1:3040 node --import tsx scripts/eval-builder-v2-chunked.mjs
 */
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

const port = process.argv[2] || "3040";
const base = (process.env.BASE || `http://127.0.0.1:${port}`).replace(/\/$/, "");

const PROMPT =
  "Maak een projectmanagement portaal met dashboard, detailpagina's, admin-overzicht, klanten, projecten, taken, rollen en login.";

const token = await createSignedSessionToken({
  userId: 1,
  email: "eval.builder@motorsai.local",
  role: "fumero",
  scope: "fumero",
});
const headers = {
  Cookie: `motorsai_token=${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log(`Eval base: ${base}`);
console.log(`Prompt: ${PROMPT.slice(0, 80)}…\n`);

const startRes = await fetch(`${base}/api/apps/generate/start`, {
  method: "POST",
  headers,
  body: JSON.stringify({ prompt: PROMPT }),
});
const startJson = await startRes.json();
console.log(`POST /api/apps/generate/start → HTTP ${startRes.status}`, startJson);

if (startRes.status !== 202 || !startJson.jobId) {
  console.error("FAIL: verwacht HTTP 202 met jobId");
  process.exit(1);
}

const jobId = startJson.jobId;
const maxWait = Number(process.env.EVAL_MAX_WAIT_MS || 580_000);
const started = Date.now();
let lastPhase = "";
let slug = "";

while (Date.now() - started < maxWait) {
  const statusRes = await fetch(
    `${base}/api/apps/generate/status?jobId=${encodeURIComponent(jobId)}`,
    { headers: { Cookie: headers.Cookie, Accept: "application/json" } }
  );
  const job = await statusRes.json();
  const msg = job.progress_message || job.phase || job.status;
  if (msg !== lastPhase) {
    console.log(`  [${job.status}] ${msg}`);
    lastPhase = msg;
  }

  if (job.status === "error") {
    console.error("FAIL:", job.error || job);
    process.exit(1);
  }

  if (job.status === "done") {
    slug = String(job.slug || job.result?.slug || "");
    console.log("\nDONE:", {
      slug,
      builder_version: job.result?.builder_version,
      generation_path: job.result?.generation_meta?.generation_path,
      chunk_count: job.result?.generation_meta?.chunk_count,
      tables: job.result?.tables,
    });
    break;
  }

  await sleep(2_000);
}

if (!slug) {
  console.error("FAIL: timeout zonder done-status");
  process.exit(1);
}

const appRes = await fetch(`${base}/api/apps/${encodeURIComponent(slug)}`, {
  headers: { Cookie: headers.Cookie, Accept: "application/json" },
});
const appJson = await appRes.json();
if (!appRes.ok || !appJson.app?.frontend_code) {
  console.error("FAIL: app detail ophalen", appJson.error || appRes.status);
  process.exit(1);
}

const html = String(appJson.app.frontend_code);
const checks = [
  ["data API slug", html.includes(`/api/apps/${slug}/data`)],
  ["nav", /role="navigation"/i.test(html) || /<nav\b/i.test(html)],
  ["hash routing", /hashchange/i.test(html)],
  ["active nav", /aria-current|classList\.toggle\s*\(\s*["']active["']/i.test(html)],
  ["POST CRUD", /method:\s*["']POST["']/i.test(html)],
  ["DELETE CRUD", /method:\s*["']DELETE["']/i.test(html)],
  ["geen 480px widget", !/max-width:\s*480px/i.test(html)],
  ["geen localStorage", !/\blocalStorage\b/i.test(html)],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`  preview check ${label}: ${ok ? "OK" : "FAIL"}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log("\nEval geslaagd — preview:", `${base}/apps/${slug}?preview=1`);
