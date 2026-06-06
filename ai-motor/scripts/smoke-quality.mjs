#!/usr/bin/env node
/**
 * Kwaliteits-smoke: stack + chat-routing + builder-readiness.
 *
 *   BASE_URL=https://motorsai.app node scripts/smoke-quality.mjs
 *   BASE_URL=http://127.0.0.1:3040 node scripts/smoke-quality.mjs
 *
 * Optioneel:
 *   SMOKE_KLANT=bokas
 *   SKIP_CHAT=1          — geen /api/chat/stream (geen LLM-kosten)
 *   REQUIRE_OPENCLAW=1   — fail als openclaw niet ok
 *   REQUIRE_BUILDER=1    — fail als geen Dify/Anthropic voor HTML/project
 */

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const klant = process.env.SMOKE_KLANT || "fumero";
const skipChat = process.env.SKIP_CHAT === "1";
const requireOpenClaw = process.env.REQUIRE_OPENCLAW === "1";
const requireBuilder = process.env.REQUIRE_BUILDER === "1";
const authToken = process.env.MOTORSAI_TOKEN?.trim() || "";

const defaultHeaders = { Accept: "application/json" };
const authHeaders = authToken
  ? { ...defaultHeaders, "x-motorsai-token": authToken }
  : defaultHeaders;

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail = "") {
  results.push({ name, ok: true, warn: true, detail });
  console.log(`  ⚠ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function getJson(path, headers = defaultHeaders) {
  const url = `${base}${path}`;
  const res = await fetch(url, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { path, status: res.status, body };
}

async function probeIntegrationReadiness() {
  console.log("\n── Fase 1b: Integration readiness ──");

  const ir = await getJson("/api/admin/integration-readiness", authHeaders);
  if (ir.status === 401) {
    warn(
      "/api/admin/integration-readiness",
      "401 — zet MOTORSAI_TOKEN voor volledige check"
    );
    return;
  }
  if (ir.status !== 200 || !ir.body) {
    fail("/api/admin/integration-readiness", `HTTP ${ir.status}`);
    return;
  }

  pass("/api/admin/integration-readiness", "200");
  const mem = ir.body.memory ?? {};
  if (mem.qdrant_url_configured) pass("QDRANT_URL", "geconfigureerd");
  else warn("QDRANT_URL", "ontbreekt");

  const cols = mem.qdrant_collections ?? [];
  if (cols.length === 0) {
    warn("qdrant collections", "geen collecties in payload");
  } else {
    for (const col of cols) {
      const ok = col.exists && (col.points_count ?? 0) > 0;
      if (ok) pass(`qdrant ${col.name}`, `${col.points_count} punten`);
      else warn(`qdrant ${col.name}`, col.error ?? "leeg of ontbreekt");
    }
  }

  if (mem.qdrant_collections_ok) pass("qdrant dual-search", "minstens één collectie met data");
  else warn("qdrant dual-search", "geen vectors — check ADR-001 collecties");

  const oc = ir.body.openclaw ?? {};
  if (oc.gateway_url_configured) {
    if (oc.ok) pass("openclaw (readiness)", "gateway OK");
    else warn("openclaw (readiness)", oc.error ?? "niet bereikbaar");
  } else {
    warn("openclaw (readiness)", "OPENCLAW_GATEWAY_URL niet gezet");
  }
}

async function probeStack() {
  console.log("\n── Fase 1: Stack ──");

  const health = await getJson("/api/health");
  if (health.status === 200 && health.body?.ok) {
    pass("/api/health", "200 ok");
  } else if (health.status === 503) {
    warn("/api/health", "503 — sommige deps down");
  } else {
    fail("/api/health", `HTTP ${health.status}`);
  }

  const stack = await getJson("/api/chat/stack-health");
  if (stack.status >= 500 && !stack.body) {
    fail("/api/chat/stack-health", `HTTP ${stack.status}`);
  } else {
    const deps = stack.body?.dependencies ?? {};
    const stackOk = stack.body?.ok === true;
    if (stackOk) pass("/api/chat/stack-health", "ok");
    else warn("/api/chat/stack-health", `HTTP ${stack.status} body.ok=false`);
    for (const key of ["n8n", "dify", "qdrant", "ollama", "openclaw"]) {
      const d = deps[key];
      if (!d) {
        warn(`dep ${key}`, "ontbreekt in payload");
        continue;
      }
      if (d.ok) pass(`dep ${key}`, `${d.latency_ms ?? "?"}ms @ ${d.url_host ?? d.host ?? "?"}`);
      else fail(`dep ${key}`, d.error || `HTTP ${d.http_status ?? "?"}`);
    }
    if (requireOpenClaw && !deps.openclaw?.ok) {
      fail("openclaw required", "REQUIRE_OPENCLAW=1");
    }
  }

  const prod = await getJson("/api/smoke-production");
  if (prod.status === 401) {
    warn(
      "/api/smoke-production",
      "401 — publiek maken in middleware of MOTORSAI_TOKEN; stack-health dekt deps"
    );
  } else if (prod.status === 200 || prod.status === 503) {
    const f = prod.body?.features ?? {};
    pass("/api/smoke-production", `HTTP ${prod.status}`);
    if (f.dify_builder_configured) pass("builder Dify", "geconfigureerd");
    else {
      if (requireBuilder) fail("builder Dify", "niet geconfigureerd");
      else warn("builder Dify", "niet geconfigureerd — HTML preview/build faalt");
    }
    if (f.anthropic_design_research_configured) pass("builder Anthropic", "geconfigureerd");
    else warn("builder Anthropic", "optioneel voor project-build");
    const oc = prod.body?.dependencies?.openclaw;
    if (oc?.ok) pass("openclaw (prod)", `${oc.latency_ms}ms`);
    else if (oc) warn("openclaw (prod)", oc.error || "niet ok");
  } else {
    fail("/api/smoke-production", `HTTP ${prod.status}`);
  }
}

async function probeChat() {
  console.log("\n── Fase 2: Chat routing ──");
  if (skipChat) {
    warn("chat stream", "SKIP_CHAT=1");
    return;
  }

  const prompt =
    process.env.SMOKE_PROMPT ||
    "Antwoord in één korte zin: welke routing gebruik je?";
  const t0 = Date.now();
  let routing = null;
  let message = "";
  let ttft = null;

  const res = await fetch(`${base}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      prompt,
      klant,
      agent_mode: false,
      plan_mode: false,
      context: [],
    }),
  });

  if (!res.ok) {
    fail("chat stream", `HTTP ${res.status}`);
    return;
  }

  const text = await res.text();
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const ev = JSON.parse(line.slice(6));
      if (ev.type === "routing" && ev.routing) routing = ev.routing;
      if (ev.type === "delta" && ev.text && ttft === null) ttft = Date.now() - t0;
      if (ev.type === "done") {
        routing = ev.routing ?? routing;
        message = ev.message ?? message;
      }
    } catch {
      /* ignore */
    }
  }

  const total = Date.now() - t0;
  if (!message.trim()) fail("chat antwoord", "leeg");
  else pass("chat antwoord", `${message.slice(0, 80).replace(/\s+/g, " ")}…`);

  if (routing === "openclaw" || routing === "openrouter") {
    pass("routing", `${routing} ttft=${ttft ?? "?"}ms total=${total}ms`);
  } else if (routing === "n8n") {
    warn("routing", `n8n fallback — OpenClaw/OpenRouter niet gebruikt`);
  } else {
    fail("routing", routing ?? "onbekend");
  }
}

async function probeBuilderRoutes() {
  console.log("\n── Fase 3: Builder endpoints (dry) ──");

  const artifactProbe = await fetch(`${base}/api/artifact/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      prompt: "maak een test widget",
      klant,
    }),
  });
  const artifactBody = await artifactProbe.json().catch(() => ({}));
  if (artifactProbe.status === 200 && artifactBody.html) {
    pass("artifact/generate", `HTML ${artifactBody.html.length} chars`);
  } else if (artifactProbe.status === 503) {
    warn(
      "artifact/generate",
      artifactBody.error || "Dify niet geconfigureerd"
    );
  } else if (artifactProbe.status === 401) {
    warn("artifact/generate", "login vereist — zet MOTORSAI_TOKEN voor volledige check");
  } else if (artifactProbe.status === 500) {
    fail("artifact/generate", artifactBody.error || "build failed");
  } else {
    warn("artifact/generate", `HTTP ${artifactProbe.status}`);
  }

  const projectProbe = await fetch(`${base}/api/project/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      prompt: "maak een eenvoudige todo app",
      klant,
    }),
  });
  const projectBody = await projectProbe.json().catch(() => ({}));
  if (projectProbe.status === 200 && projectBody.files) {
    pass("project/generate", `${Object.keys(projectBody.files).length} files`);
  } else if (projectProbe.status === 503) {
    warn(
      "project/generate",
      projectBody.hint || projectBody.error || "builder niet klaar"
    );
  } else if (projectProbe.status === 401) {
    warn("project/generate", "login vereist — zet MOTORSAI_TOKEN");
  } else if (projectProbe.status === 500) {
    fail("project/generate", projectBody.error || "failed");
  } else {
    warn("project/generate", `HTTP ${projectProbe.status}`);
  }
}

async function probeCodeWorkspace() {
  console.log("\n── Fase 5: Motor Code ──");
  const exec = await getJson("/api/local-executor/health", authHeaders);
  if (exec.body?.reachable) pass("local executor", "reachable");
  else warn("local executor", exec.body?.error ?? "niet bereikbaar — /code faalt");

  const ws = await getJson(
    `/api/code/workspaces?klant=${encodeURIComponent(klant)}`,
    authHeaders
  );
  if (ws.status === 401) {
    warn("/api/code/workspaces", "login vereist — zet MOTORSAI_TOKEN");
    return;
  }
  if (ws.status === 200) {
    const n = ws.body?.workspaces?.length ?? 0;
    pass("/api/code/workspaces", `${n} project(en)`);
  } else if (ws.status === 503) {
    warn("/api/code/workspaces", ws.body?.error ?? "executor/config");
  } else {
    fail("/api/code/workspaces", `HTTP ${ws.status}`);
  }
}

async function probeSchool() {
  console.log("\n── Fase 4: Motor School ──");
  const school = await getJson("/api/school");
  if (school.status === 200 && school.body?.today?.id) {
    pass("/api/school", `les ${school.body.today.id}`);
  } else if (school.status === 401 || school.status === 307) {
    warn("/api/school", "auth vereist — OK op productie");
  } else {
    fail("/api/school", `HTTP ${school.status}`);
  }
}

function printSummary() {
  console.log("\n── Samenvatting ──");
  const failed = results.filter((r) => !r.ok);
  const warned = results.filter((r) => r.warn);
  console.log(`Checks: ${results.length} | fail: ${failed.length} | warn: ${warned.length}`);

  if (failed.length) {
    console.log("\nMotor-kwaliteit: NIET groen — fix stack/builder eerst.");
    console.log("Veelvoorkomend bij HTML/menu:");
    console.log("  • Dify key ontbreekt → artifact preview werkt niet");
    console.log("  • 'bokas menu' → project-build i.p.v. chat; zie docs/motor-build-guide.md");
    process.exit(1);
  }
  if (warned.length) {
    console.log("\nMotor-kwaliteit: deels OK — bekijk warnings (builder/openclaw).");
    process.exit(0);
  }
  console.log("\nMotor-kwaliteit: groen.");
}

async function main() {
  console.log(`Smoke quality — ${base} (klant=${klant})`);
  await probeStack();
  await probeIntegrationReadiness();
  await probeChat();
  await probeBuilderRoutes();
  await probeSchool();
  await probeCodeWorkspace();
  printSummary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
