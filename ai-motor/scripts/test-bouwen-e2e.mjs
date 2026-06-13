#!/usr/bin/env node
/**
 * Bouwen E2E: 3 standaard prompts via async tool generation API.
 *
 *   BASE_URL=http://127.0.0.1:3040 node scripts/test-bouwen-e2e.mjs
 */
import { createFumeroTestCookie } from "./lib/motorsai-test-auth.mjs";

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const maxWaitMs = Number(process.env.BOUWEN_E2E_MAX_MS || 600_000);

const cookie = await createFumeroTestCookie(base);

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Cookie: cookie,
};

const PROMPTS = [
  {
    id: "landing",
    name: "E2E Landingspagina",
    template_id: "landing",
    prompt:
      "Maak een premium B2B landingspagina voor Fumero met hero, 3 voordelen, CTA-knop en footer. Witte achtergrond, groen #69C400 op primaire knop.",
  },
  {
    id: "calculator",
    name: "E2E Rekenmachine",
    template_id: "calculator",
    prompt:
      "Maak een simpele rekenmachine met display en knoppen + en - om het getal te verhogen en verlagen. Donkere achtergrond, groene accenten.",
  },
  {
    id: "todo",
    name: "E2E Todo lijst",
    template_id: undefined,
    prompt:
      "Maak een todo-lijst widget met 3 startitems, invoerveld om items toe te voegen en knop om items te verwijderen. Vanilla JS, mobielvriendelijk.",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function startJob(caseDef) {
  const res = await fetch(`${base}/api/fumero/tools/generate/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "create",
      name: caseDef.name,
      prompt: caseDef.prompt,
      deploy_type: "widget",
      template_id: caseDef.template_id,
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${caseDef.id}: start geen JSON (${res.status}): ${text.slice(0, 120)}`);
  }
  if (res.status === 401) throw new Error(`${caseDef.id}: 401 — auth mislukt`);
  if (!json.jobId) {
    throw new Error(`${caseDef.id}: geen jobId — ${json.error || res.status}`);
  }
  return json.jobId;
}

async function pollJob(caseDef, jobId) {
  const started = Date.now();
  let lastPhase = "";
  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(
      `${base}/api/fumero/tools/generate/status?jobId=${encodeURIComponent(jobId)}`,
      { headers: { Accept: "application/json", Cookie: headers.Cookie } }
    );
    const json = await res.json().catch(() => ({}));
    const phase = json.phase || json.status || "";
    if (phase !== lastPhase) {
      console.log(`    … ${caseDef.id}: ${phase} (${Math.round((Date.now() - started) / 1000)}s)`);
      lastPhase = phase;
    }
    if (json.status === "done") {
      return {
        ok: true,
        elapsedMs: Date.now() - started,
        toolId: json.result?.tool_id,
        previewUrl: json.result?.preview_url,
      };
    }
    if (json.status === "error") {
      return {
        ok: false,
        elapsedMs: Date.now() - started,
        error: json.error || "onbekende fout",
      };
    }
    await sleep(json.status === "pending" ? 2000 : 3500);
  }
  return { ok: false, elapsedMs: maxWaitMs, error: "timeout" };
}

async function fetchPreviewHtml(previewPath) {
  if (!previewPath) return null;
  const url = previewPath.startsWith("http") ? previewPath : `${base}${previewPath}`;
  const res = await fetch(url, { headers: { Cookie: headers.Cookie } });
  if (!res.ok) return null;
  return res.text();
}

console.log(`\nBouwen E2E @ ${base}\n`);

const results = [];

for (const caseDef of PROMPTS) {
  console.log(`▶ ${caseDef.id}: ${caseDef.prompt.slice(0, 60)}…`);
  const t0 = Date.now();
  try {
    const jobId = await startJob(caseDef);
    const outcome = await pollJob(caseDef, jobId);
    if (!outcome.ok) {
      console.log(`  ✗ FAIL (${Math.round(outcome.elapsedMs / 1000)}s): ${outcome.error}`);
      results.push({ id: caseDef.id, ok: false, error: outcome.error, ms: outcome.elapsedMs });
      continue;
    }
    const preview = await fetchPreviewHtml(outcome.previewUrl);
    const previewOk =
      preview &&
      preview.length > 200 &&
      (/<button\b/i.test(preview) || /<canvas\b/i.test(preview) || /<input\b/i.test(preview));
    const ms = Date.now() - t0;
    if (previewOk) {
      console.log(`  ✓ OK (${Math.round(ms / 1000)}s) tool=${outcome.toolId}`);
      results.push({ id: caseDef.id, ok: true, ms, toolId: outcome.toolId });
    } else {
      console.log(`  ✗ FAIL preview leeg of kapot (${Math.round(ms / 1000)}s)`);
      results.push({ id: caseDef.id, ok: false, error: "preview kapot", ms });
    }
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`  ✗ FAIL (${Math.round(ms / 1000)}s): ${e.message}`);
    results.push({ id: caseDef.id, ok: false, error: e.message, ms });
  }
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n── Resultaat: ${passed}/${results.length} ──`);
for (const r of results) {
  console.log(
    `  ${r.ok ? "✓" : "✗"} ${r.id}${r.ms ? ` (${Math.round(r.ms / 1000)}s)` : ""}${r.error ? ` — ${r.error}` : ""}`
  );
}

process.exit(passed === results.length ? 0 : 1);
