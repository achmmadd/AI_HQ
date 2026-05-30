#!/usr/bin/env node
/**
 * Publieke smoke tegen productie of een staging-URL.
 *
 *   BASE_URL=https://motorsai.app node scripts/smoke-motorsai.mjs
 *   node scripts/smoke-motorsai.mjs   # default: https://motorsai.app
 */

const base = (process.env.BASE_URL || "https://motorsai.app").replace(/\/$/, "");

async function probe(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { path, status: res.status, body };
}

async function main() {
  console.log(`Smoke base: ${base}\n`);
  const routes = ["/api/health", "/api/smoke-production"];

  let failed = false;
  for (const path of routes) {
    try {
      const { status, body } = await probe(path);
      if (path === "/api/smoke-production") {
        if (status !== 200 && status !== 503) {
          failed = true;
          console.error(
            `${path} → HTTP ${status} (verwacht 200 of 503 na deploy met publieke /api/smoke-production)`
          );
        }
      } else if (status >= 500) {
        failed = true;
      }
      console.log(`${path} → HTTP ${status}`);
      if (body && typeof body === "object") {
        if (path === "/api/smoke-production") {
          const b = body;
          console.log(
            `  features: deploy=${b.features?.deploy_configured} builder=${b.features?.dify_builder_configured} anthropic=${b.features?.anthropic_design_research_configured}`
          );
          console.log(`  app_version: ${b.app_version ?? "—"}`);
          const d = b.dependencies || {};
          for (const k of Object.keys(d)) {
            const dep = d[k];
            console.log(`  dep ${k}: ok=${dep.ok} ${dep.latency_ms ?? "?"}ms`);
          }
        }
        if (path === "/api/health" && body.dependencies) {
          for (const [k, dep] of Object.entries(body.dependencies)) {
            console.log(`  dep ${k}: ok=${dep.ok}`);
          }
        }
      }
      console.log("");
    } catch (e) {
      failed = true;
      console.error(`${path} → FOUT: ${e instanceof Error ? e.message : e}\n`);
    }
  }

  if (failed) {
    console.error("Smoke: minstens één check faalde of gaf serverfout.");
    process.exit(1);
  }
  console.log("Smoke: routes bereikbaar (HTTP < 500).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
