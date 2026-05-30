#!/usr/bin/env node
/**
 * Cowork hub smoke tests
 *   MOTORSAI_TOKEN=… node scripts/test-cowork.mjs
 */
import fs from "fs";
import path from "path";

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const token = process.env.MOTORSAI_TOKEN?.trim() || "";
const headers = token
  ? { "x-motorsai-token": token, Accept: "application/json" }
  : { Accept: "application/json" };

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed++;
}

async function getJson(p) {
  const res = await fetch(`${base}${p}`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`Cowork tests — ${base}`);

  const components = [
    "components/cowork/CoworkDashboard.tsx",
    "components/cowork/CoworkTasksPanel.tsx",
    "components/cowork/CoworkApprovalsInbox.tsx",
    "components/cowork/CoworkSkillsPanel.tsx",
  ];
  for (const c of components) {
    if (fs.existsSync(path.join(process.cwd(), c))) pass(c);
    else fail(`${c} ontbreekt`);
  }

  const page = await fetch(`${base}/cowork`, { headers, redirect: "manual" });
  if (page.status === 200) pass("/cowork HTTP 200");
  else fail(`/cowork HTTP ${page.status}`);

  if (!token) {
    console.log("  ⚠ skip API tests — zet MOTORSAI_TOKEN");
  } else {
    const approvals = await getJson("/api/cowork/approvals");
    if (approvals.status === 200 && Array.isArray(approvals.body?.items)) {
      pass("cowork approvals aggregate");
    } else fail(`cowork approvals HTTP ${approvals.status}`);

    const skills = await getJson("/api/cowork/skills?klant=fumero");
    if (skills.status === 200) pass("cowork skills GET");
    else fail(`cowork skills HTTP ${skills.status}`);

    const audit = await getJson("/api/cowork/audit?limit=5");
    if (audit.status === 200) pass("cowork audit GET");
    else fail(`cowork audit HTTP ${audit.status}`);

    const n8n = await getJson("/api/cowork/n8n-runs");
    if (n8n.status === 200) pass("cowork n8n-runs GET");
    else fail(`cowork n8n-runs HTTP ${n8n.status}`);
  }

  if (failed) {
    console.error(`FAIL: ${failed}`);
    process.exit(1);
  }
  console.log("PASS: cowork groen");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
