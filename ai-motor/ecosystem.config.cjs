/**
 * PM2: vaste Node-binary zodat better-sqlite3 (native) bij de runtime past.
 * Op andere machines: export AI_MOTOR_NODE="$(nvm which node)" vóór pm2 start.
 *
 * instances: 1 — bewust tot SQLite uit productie (ADR-002 M6, ~9 aug 2026).
 * better-sqlite3 is single-writer; cluster mode breekt tot POSTGRES_PRIMARY=1
 * en SQLITE_FALLBACK=0. Her-evalueer instances na PG cutover (M4/M6).
 */
const path = require("path");
const fs = require("fs");

const NODE_INTERPRETER =
  process.env.AI_MOTOR_NODE?.trim() ||
  "/home/pietje/.nvm/versions/node/v22.22.2/bin/node";

/** Laad .env.local keys in process.env voor PM2 (Next leest ook .env.local, dit is backup). */
function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  try {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

module.exports = {
  apps: [
    {
      name: "ai-motor",
      cwd: __dirname,
      interpreter: NODE_INTERPRETER,
      script: path.join(__dirname, "node_modules/next/dist/bin/next"),
      args: "start -p 3040",
      exec_mode: "fork",
      /** ADR-002 M6: blijft 1 tot SQLite uit prod — zie header comment. */
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        MOTORSAI_DEV_PANEL: "1",
        LOCAL_EXECUTOR_URL: process.env.LOCAL_EXECUTOR_URL,
        LOCAL_EXECUTOR_SECRET: process.env.LOCAL_EXECUTOR_SECRET,
        LOCAL_WORKSPACE_ROOT: process.env.LOCAL_WORKSPACE_ROOT,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        MOTOR_CODE_PROVIDER: process.env.MOTOR_CODE_PROVIDER,
        MOTOR_CODE_MODEL: process.env.MOTOR_CODE_MODEL,
        MOTOR_CODE_MIN_CODING_SCORE: process.env.MOTOR_CODE_MIN_CODING_SCORE,
        MOTORS_INTERNAL_TOKEN: process.env.MOTORS_INTERNAL_TOKEN,
      },
    },
    {
      name: "local-executor",
      cwd: path.join(__dirname, "..", "agent_service"),
      script: path.join(__dirname, "..", "agent_service", "run_executor.sh"),
      interpreter: "bash",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        LOCAL_WORKSPACE_ROOT:
          process.env.LOCAL_WORKSPACE_ROOT || "/home/pietje/AI_HQ/projects",
        LOCAL_EXECUTOR_SECRET: process.env.LOCAL_EXECUTOR_SECRET,
        LOCAL_EXECUTOR_PORT: "8790",
      },
    },
  ],
};
