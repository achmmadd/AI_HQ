#!/usr/bin/env node
/**
 * Merge ontbrekende env-keys naar ai-motor/.env.local vanaf bekende bronnen op de NUC.
 * Volgorde: eerst AI_HQ/.env (+ zusterbestanden), daarna ~/.env, project-.env's, tot slot
 * oude backups (.env.bak.webui*) — alleen keys die nog niet in de merge-map zaten.
 * Overschrijft bestaande .env.local-regels niet. Maakt backup .env.local.bak.<timestamp>
 *
 * Run vanuit ai-motor: npm run env:merge
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOTOR_ROOT = path.resolve(__dirname, "..");
const AI_HQ = path.resolve(MOTOR_ROOT, "..");
const HOME = os.homedir();
const TARGET = path.join(MOTOR_ROOT, ".env.local");

function discoverBakWebui() {
  if (!fs.existsSync(AI_HQ)) return [];
  try {
    return fs
      .readdirSync(AI_HQ)
      .filter((n) => n.startsWith(".env.bak.webui"))
      .sort()
      .map((n) => path.join(AI_HQ, n));
  } catch {
    return [];
  }
}

const SOURCE_FILES = [
  path.join(AI_HQ, ".env"),
  path.join(AI_HQ, ".env.zwartehand"),
  path.join(AI_HQ, ".env.1panel"),
  path.join(HOME, ".env"),
  path.join(AI_HQ, "evomap", ".env"),
  path.join(HOME, "inventory-pwa", ".env"),
  path.join(HOME, "B-werkerssteem", ".env"),
  ...discoverBakWebui(),
].filter((p) => fs.existsSync(p));

/** Als target-key leeg is, vul vanuit bron-key */
const ALIASES = [
  { target: "DIFY_API_KEY", sources: ["DIFY_RESEARCH_API_KEY", "DIFY_API_KEY"] },
  {
    target: "N8N_FACTORY_WEBHOOK",
    sources: ["N8N_FACTORY_WEBHOOK", "N8N_FACTORY_OS_WEBHOOK"],
  },
  {
    target: "TELEGRAM_BOT_TOKEN",
    sources: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_TOKEN"],
  },
];

/** Direct over te nemen als aanwezig in bron en ontbreekt in target */
const PASS_THROUGH_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_CHAT_MODEL",
  "OPENROUTER_API_KEY",
  "KIMI_API_KEY",
  "KIMI_MODEL",
  "JUNIOR_MODEL",
  "COMPUTER_USE_URL",
  "COMPUTER_USE_VIEWER_URL",
  "COMPUTER_USE_SCREENSHOT_URL",
  "AGENT_STREAM_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "VERCEL_TOKEN",
  "VERCEL_TEAM_ID",
  "FAL_API_KEY",
  "ODOO_URL",
  "ODOO_DB",
  "GOOGLE_API_KEY",
  "DIFY_BASE_URL",
  "DIFY_SOCIAL_API_KEY",
  "DIFY_API_KEY",
  "N8N_FACTORY_OS_WEBHOOK",
  "N8N_FACTORY_WEBHOOK",
  "N8N_ENTREPRENEUR_WEBHOOK",
  "N8N_REVIEW_WEBHOOK",
  "N8N_API_KEY",
  "N8N_BASE_URL",
  "FEEDBACK_CRON_SECRET",
  "QDRANT_URL",
  "QDRANT_MEMORY_COLLECTION",
  "QDRANT_COLLECTION",
  "OLLAMA_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_VERSION",
  "MOTORSAI_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "AI_MOTOR_NODE",
];

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const map = new Map();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const noExport = t.replace(/^export\s+/i, "");
    const eq = noExport.indexOf("=");
    if (eq <= 0) continue;
    const key = noExport.slice(0, eq).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    let val = noExport.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val !== "") map.set(key, val);
  }
  return map;
}

function parseTargetLines() {
  const raw = fs.readFileSync(TARGET, "utf8");
  const defined = new Set();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const noExport = t.replace(/^export\s+/i, "");
    const eq = noExport.indexOf("=");
    if (eq <= 0) continue;
    const key = noExport.slice(0, eq).trim();
    let val = noExport.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (/^[A-Z][A-Z0-9_]*$/.test(key) && val !== "") defined.add(key);
  }
  return { raw, definedKeys: defined };
}

function mergeSources() {
  const merged = new Map();
  for (const f of SOURCE_FILES) {
    const m = parseEnvFile(f);
    for (const [k, v] of m) {
      if (!merged.has(k)) merged.set(k, v);
    }
  }
  return merged;
}

function escapeForEnv(val) {
  if (!/[\s#'"$\\]/.test(val)) return val;
  return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function main() {
  const { raw, definedKeys } = parseTargetLines();
  const sources = mergeSources();
  const additions = [];
  const applied = [];

  for (const key of PASS_THROUGH_KEYS) {
    if (definedKeys.has(key)) continue;
    const v = sources.get(key);
    if (v) {
      additions.push(`${key}=${escapeForEnv(v)}`);
      applied.push(key);
    }
  }

  for (const { target, sources: srcKeys } of ALIASES) {
    if (
      definedKeys.has(target) ||
      additions.some((l) => l.startsWith(`${target}=`))
    ) {
      continue;
    }
    for (const sk of srcKeys) {
      const v = sources.get(sk);
      if (v) {
        const comment = sk !== target ? ` # merged from ${sk}` : "";
        additions.push(`${target}=${escapeForEnv(v)}${comment}`);
        applied.push(`${target}←${sk}`);
        break;
      }
    }
  }

  if (additions.length === 0) {
    console.log(
      "env:merge — niets toe te voegen (keys al gezet of geen bronwaarden op NUC)."
    );
    console.log(
      "Bronnen:",
      SOURCE_FILES.map((p) => path.relative(MOTOR_ROOT, p)).join(", ")
    );
    return;
  }

  const bak = `${TARGET}.bak.${Date.now()}`;
  fs.copyFileSync(TARGET, bak);

  const block = `\n# --- Auto-merged ${new Date().toISOString()} (NUC-bronnen) ---\n${additions.join("\n")}\n`;
  fs.writeFileSync(TARGET, raw.replace(/\s*$/, "") + block, "utf8");
  console.log(`Backup: ${path.relative(MOTOR_ROOT, bak)}`);
  console.log(`Toegevoegd (${additions.length}): ${applied.join(", ")}`);
  console.log(
    "Gescande bronnen:",
    SOURCE_FILES.map((p) => path.relative(HOME, p) || p).join(", ")
  );
}

main();