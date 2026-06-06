#!/usr/bin/env node
/**
 * Hybrid smoke — NUC → Hetzner connectivity (Sprint 3.1).
 *
 *   node scripts/hybrid-smoke.mjs
 *   QDRANT_URL=http://hetzner-motor:6333 OLLAMA_URL=... DATABASE_URL=... node scripts/hybrid-smoke.mjs
 *
 * Optioneel:
 *   LITELLM_BASE_URL=http://hetzner-motor:4000
 *   REQUIRE_PG=1        — fail als DATABASE_URL ontbreekt of PG down
 *   REQUIRE_LITELLM=1   — fail als LiteLLM geconfigureerd maar down
 *   REQUIRE_EMBED_MODEL=1 — fail als nomic-embed-text niet in Ollama tags
 */

const TIMEOUT_MS = 8_000;

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
  /\/$/,
  ""
);
const DATABASE_URL = process.env.DATABASE_URL?.trim() || "";
const LITELLM_BASE = (
  process.env.LITELLM_BASE_URL ||
  process.env.LITELLM_PROXY_URL ||
  ""
).replace(/\/$/, "");
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const REQUIRE_PG = process.env.REQUIRE_PG === "1";
const REQUIRE_LITELLM = process.env.REQUIRE_LITELLM === "1";
const REQUIRE_EMBED_MODEL = process.env.REQUIRE_EMBED_MODEL === "1";

const results = [];
let failed = false;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failed = true;
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail = "") {
  results.push({ name, ok: true, warn: true, detail });
  console.log(`  ⚠ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchProbe(url, label) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - t0;
    if (res.ok || (label === "dify" && res.status === 401)) {
      pass(label, `${res.status} · ${ms}ms · ${new URL(url).host}`);
      return true;
    }
    fail(label, `HTTP ${res.status} · ${ms}ms`);
    return false;
  } catch (e) {
    fail(label, e instanceof Error ? e.message : String(e));
    return false;
  }
}

async function probeQdrant() {
  console.log("\n── Qdrant ──");
  const ok = await fetchProbe(`${QDRANT_URL}/collections`, "Qdrant ping");
  if (!ok) return;

  try {
    const res = await fetch(`${QDRANT_URL}/collections`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json();
    const names = (data.result?.collections ?? [])
      .map((c) => c.name)
      .filter(Boolean);
    if (names.length === 0) {
      warn("Qdrant collections", "geen collecties — OK na migratie/ingest");
    } else {
      pass("Qdrant collections", names.slice(0, 6).join(", "));
    }
  } catch (e) {
    warn("Qdrant collections", e instanceof Error ? e.message : String(e));
  }
}

async function probeOllama() {
  console.log("\n── Ollama (embed) ──");
  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      fail("Ollama ping", `HTTP ${res.status}`);
      return;
    }
    pass("Ollama ping", `${ms}ms · ${new URL(OLLAMA_URL).host}`);

    const data = await res.json();
    const models = (data.models ?? []).map((m) => m.name ?? m.model).filter(Boolean);
    const hasEmbed = models.some(
      (m) => m === EMBED_MODEL || m.startsWith(`${EMBED_MODEL}:`)
    );
    if (hasEmbed) {
      pass("Embed model", EMBED_MODEL);
    } else if (REQUIRE_EMBED_MODEL) {
      fail("Embed model", `${EMBED_MODEL} niet gevonden — run: docker compose --profile init run --rm ollama-init`);
    } else {
      warn("Embed model", `${EMBED_MODEL} niet geladen (models: ${models.join(", ") || "geen"})`);
    }
  } catch (e) {
    fail("Ollama ping", e instanceof Error ? e.message : String(e));
  }
}

async function probePostgres() {
  console.log("\n── Postgres ──");
  if (!DATABASE_URL) {
    if (REQUIRE_PG) fail("Postgres", "DATABASE_URL ontbreekt");
    else warn("Postgres", "DATABASE_URL niet gezet — skip");
    return;
  }

  const t0 = Date.now();
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(DATABASE_URL, {
      max: 1,
      connect_timeout: 6,
      idle_timeout: 1,
      prepare: false,
    });
    const rows = await sql`SELECT version() AS v`;
    await sql.end({ timeout: 2 });
    const host = (() => {
      try {
        return new URL(DATABASE_URL.replace(/^postgres:/, "http:")).host;
      } catch {
        return "postgres";
      }
    })();
    pass("Postgres ping", `${Date.now() - t0}ms · ${host} · ${String(rows[0]?.v ?? "ok").slice(0, 40)}…`);
  } catch (e) {
    fail("Postgres ping", e instanceof Error ? e.message : String(e));
  }
}

async function probeLiteLLM() {
  console.log("\n── LiteLLM (optioneel) ──");
  if (!LITELLM_BASE) {
    warn("LiteLLM", "LITELLM_BASE_URL niet gezet — skip");
    return;
  }
  const ok = await fetchProbe(`${LITELLM_BASE}/health/liveliness`, "LiteLLM");
  if (!ok && REQUIRE_LITELLM) {
    fail("LiteLLM required", "REQUIRE_LITELLM=1 maar proxy down");
  }
}

async function main() {
  console.log("Hybrid smoke — NUC → Hetzner");
  console.log(`  QDRANT_URL=${QDRANT_URL}`);
  console.log(`  OLLAMA_URL=${OLLAMA_URL}`);
  console.log(`  DATABASE_URL=${DATABASE_URL ? "[set]" : "[unset]"}`);
  console.log(`  LITELLM=${LITELLM_BASE || "[unset]"}`);
  console.log(`  Docs: docs/hybrid-env.md`);

  await probeQdrant();
  await probeOllama();
  await probePostgres();
  await probeLiteLLM();

  console.log("\n── Summary ──");
  const okCount = results.filter((r) => r.ok && !r.warn).length;
  const warnCount = results.filter((r) => r.warn).length;
  const failCount = results.filter((r) => !r.ok).length;
  console.log(`  ${okCount} passed, ${warnCount} warnings, ${failCount} failed`);

  if (failed) {
    console.error("\nHybrid smoke FAILED — zie docs/hybrid-env.md en hetzner-migration.md checklist");
    process.exit(1);
  }
  console.log("\nHybrid smoke OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
