#!/usr/bin/env node
/**
 * End-to-end hybrid validation — Sprint 3.3 (Motor API + optional infra).
 *
 *   BASE_URL=http://127.0.0.1:3040 MOTORSAI_TOKEN=… node scripts/e2e-hybrid.mjs
 *
 * Optioneel:
 *   SMOKE_KLANT=fumero
 *   SKIP_CHAT=1              — geen /api/chat/stream (geen LLM-kosten)
 *   RUN_INFRA_SMOKE=1        — draai eerst scripts/hybrid-smoke.mjs
 *   REQUIRE_HYBRID_CORE=1    — fail als integration-readiness hybrid.hetzner_core_ok false
 *   REQUIRE_KENNISBANK=1     — fail als kennisbank-zoek 0 treffers
 *   REQUIRE_N8N=1            — fail als n8n niet bereikbaar (via readiness of N8N_BASE_URL)
 *   REQUIRE_OPENCLAW=1       — fail als openclaw niet ok in readiness
 *   SKIP_N8N=1               — sla n8n ping over
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const klant = (process.env.SMOKE_KLANT || "fumero").trim().toLowerCase();
const authToken = process.env.MOTORSAI_TOKEN?.trim() || "";
const skipChat = process.env.SKIP_CHAT === "1";
const runInfraSmoke = process.env.RUN_INFRA_SMOKE === "1";
const requireHybridCore = process.env.REQUIRE_HYBRID_CORE === "1";
const requireKennisbank = process.env.REQUIRE_KENNISBANK === "1";
const requireN8n = process.env.REQUIRE_N8N === "1";
const requireOpenClaw = process.env.REQUIRE_OPENCLAW === "1";
const skipN8n = process.env.SKIP_N8N === "1";

const defaultHeaders = { Accept: "application/json" };
const authHeaders = authToken
  ? { ...defaultHeaders, "x-motorsai-token": authToken }
  : defaultHeaders;

const results = [];
let failed = false;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail = "") {
  results.push({ name, ok: true, warn: true, detail });
  console.log(`  ⚠ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failed = true;
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function getJson(pathname, headers = defaultHeaders) {
  const res = await fetch(`${base}${pathname}`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function probeInfraSmoke() {
  if (!runInfraSmoke) return;
  console.log("\n── Infra: hybrid-smoke.mjs ──");
  const script = path.join(__dirname, "hybrid-smoke.mjs");
  const child = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  if (child.status !== 0) {
    fail("hybrid-smoke.mjs", "infra connectivity failed");
  } else {
    pass("hybrid-smoke.mjs", "NUC → Hetzner OK");
  }
}

async function probeChatAuth() {
  console.log("\n── Chat API auth ──");

  const unauth = await fetch(`${base}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      prompt: "auth probe",
      klant,
      agent_mode: false,
      plan_mode: false,
      context: [],
    }),
  });
  if (unauth.status === 401) {
    pass("chat stream unauthenticated", "401 Unauthorized");
  } else {
    fail("chat stream unauthenticated", `verwacht 401, kreeg ${unauth.status}`);
  }

  if (!authToken) {
    warn("chat stream authenticated", "MOTORSAI_TOKEN ontbreekt — skip");
    return;
  }

  const authed = await fetch(`${base}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      prompt: "Antwoord met één woord: ok",
      klant,
      agent_mode: false,
      plan_mode: false,
      context: [],
    }),
  });

  if (skipChat) {
    if (authed.status === 401) fail("chat stream authenticated", "401 met token");
    else pass("chat stream authenticated", `HTTP ${authed.status} (SKIP_CHAT=1)`);
    return;
  }

  if (!authed.ok) {
    fail("chat stream authenticated", `HTTP ${authed.status}`);
    return;
  }

  const text = await authed.text();
  const hasDone = text.includes('"type":"done"') || text.includes('"type": "done"');
  if (hasDone) pass("chat stream authenticated", "SSE done event");
  else warn("chat stream authenticated", "200 maar geen done-event — check routing");
}

async function probeKennisbankSearch() {
  console.log("\n── Kennisbank search ──");

  if (!authToken) {
    const probe = await fetch(`${base}/api/knowledge/qdrant-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "test", klant, limit: 3 }),
    });
    if (probe.status === 401) pass("kennisbank auth gate", "401 zonder token");
    else fail("kennisbank auth gate", `verwacht 401, kreeg ${probe.status}`);
    return;
  }

  const query = process.env.SMOKE_KB_QUERY || "offerte";
  const res = await fetch(`${base}/api/knowledge/qdrant-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ query, klant, limit: 5 }),
  });

  if (res.status === 401) {
    fail("kennisbank search", "401 — ongeldige MOTORSAI_TOKEN");
    return;
  }
  if (res.status === 403) {
    fail("kennisbank search", `403 — scope mismatch voor klant=${klant}`);
    return;
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    fail("kennisbank search", errBody.error || `HTTP ${res.status}`);
    return;
  }

  const body = await res.json();
  const n = Array.isArray(body.results) ? body.results.length : 0;
  const cols = (body.collections ?? []).join(", ") || "?";
  if (n > 0) pass("kennisbank search", `${n} treffer · ${cols}`);
  else if (requireKennisbank) fail("kennisbank search", `0 treffers voor "${query}" (${cols})`);
  else warn("kennisbank search", `0 treffers voor "${query}" — check Qdrant ingest`);
}

async function probeIntegrationReadiness() {
  console.log("\n── Integration readiness ──");

  const ir = await getJson("/api/admin/integration-readiness");
  if (ir.status !== 200 || !ir.body) {
    fail("/api/admin/integration-readiness", `HTTP ${ir.status}`);
    return;
  }

  pass("/api/admin/integration-readiness", "200");

  const hybrid = ir.body.hybrid ?? {};
  if (hybrid.hetzner_core_ok) pass("hybrid.hetzner_core_ok", "core Hetzner bereikbaar");
  else if (requireHybridCore) fail("hybrid.hetzner_core_ok", "false — check QDRANT/OLLAMA/PG");
  else warn("hybrid.hetzner_core_ok", "false — infra niet volledig");

  const mem = ir.body.memory ?? {};
  if (mem.qdrant_collections_ok) pass("qdrant dual-search", "collecties met data");
  else warn("qdrant dual-search", "geen vectors in gemonitorde collecties");

  const oc = ir.body.openclaw ?? {};
  if (oc.ok) pass("openclaw readiness", "gateway OK");
  else if (requireOpenClaw) fail("openclaw readiness", oc.error ?? "niet ok");
  else warn("openclaw readiness", oc.error ?? "niet geconfigureerd of down");

  return ir.body;
}

async function probeApprovals() {
  console.log("\n── Approvals inbox ──");

  if (!authToken) {
    warn("/api/cowork/approvals", "MOTORSAI_TOKEN ontbreekt — skip");
    return;
  }

  const res = await getJson("/api/cowork/approvals", authHeaders);
  if (res.status === 401) {
    fail("/api/cowork/approvals", "401 — token ongeldig");
    return;
  }
  if (res.status !== 200 || !res.body) {
    fail("/api/cowork/approvals", `HTTP ${res.status}`);
    return;
  }

  const total = res.body.counts?.total ?? res.body.items?.length ?? 0;
  const bk = res.body.bookkeeping ?? {};
  pass("/api/cowork/approvals", `${total} item(s) · bookkeeping=${bk.status ?? "?"}`);
  if (bk.status === "offline") {
    warn("bookkeeping-bot", bk.error ?? "offline op :8001 — graceful OK");
  } else if (bk.status === "ok") {
    pass("bookkeeping-bot", "online");
  }
}

async function probeN8n(readinessBody) {
  if (skipN8n) {
    warn("n8n ping", "SKIP_N8N=1");
    return;
  }

  console.log("\n── n8n (optioneel) ──");

  const n8nFromReadiness = readinessBody?.hybrid?.services?.n8n;
  const n8nBase = (
    process.env.N8N_BASE_URL ||
    (() => {
      const wh =
        process.env.N8N_FACTORY_WEBHOOK ||
        process.env.N8N_FACTORY_OS_WEBHOOK ||
        "";
      if (!wh) return "";
      try {
        return new URL(wh).origin;
      } catch {
        return "";
      }
    })()
  ).replace(/\/$/, "");

  if (!n8nBase && !n8nFromReadiness?.configured) {
    warn("n8n ping", "N8N_BASE_URL / webhook niet gezet — skip");
    return;
  }

  if (n8nFromReadiness?.configured) {
    if (n8nFromReadiness.ok) {
      pass("n8n (readiness)", `${n8nFromReadiness.ms ?? "?"}ms @ ${n8nFromReadiness.url_host ?? "?"}`);
      return;
    }
    if (requireN8n) fail("n8n (readiness)", n8nFromReadiness.error ?? "down");
    else warn("n8n (readiness)", n8nFromReadiness.error ?? "down");
    return;
  }

  const healthUrl = `${n8nBase}/healthz`;
  try {
    const t0 = Date.now();
    const res = await fetch(healthUrl, {
      signal: AbortSignal.timeout(8_000),
    });
    const ms = Date.now() - t0;
    if (res.ok) pass("n8n ping", `${res.status} · ${ms}ms · ${new URL(healthUrl).host}`);
    else if (requireN8n) fail("n8n ping", `HTTP ${res.status}`);
    else warn("n8n ping", `HTTP ${res.status}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (requireN8n) fail("n8n ping", msg);
    else warn("n8n ping", msg);
  }
}

async function main() {
  console.log(`E2E hybrid — ${base} (klant=${klant})`);
  console.log("  Docs: docs/hybrid-env.md · docs/nuc-readiness.md");

  await probeInfraSmoke();
  await probeChatAuth();
  const readiness = await probeIntegrationReadiness();
  await probeKennisbankSearch();
  await probeApprovals();
  await probeN8n(readiness);

  console.log("\n── Summary ──");
  const okCount = results.filter((r) => r.ok && !r.warn).length;
  const warnCount = results.filter((r) => r.warn).length;
  const failCount = results.filter((r) => !r.ok).length;
  console.log(`  ${okCount} passed, ${warnCount} warnings, ${failCount} failed`);

  if (failed) {
    console.error("\nE2E hybrid FAILED");
    process.exit(1);
  }
  console.log("\nE2E hybrid OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
