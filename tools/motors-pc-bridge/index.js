#!/usr/bin/env node
/**
 * MotorsAI PC Bridge — same ops as NUC local_executor, polls NUC for tasks.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const CONFIG_PATH = path.join(
  process.env.HOME || "",
  ".motors-pc-bridge.json"
);

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

async function httpJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  }
  return data;
}

function resolveInWorkspace(root, rel) {
  const p = path.resolve(root, rel || ".");
  if (!p.startsWith(path.resolve(root))) {
    throw new Error("path outside workspace");
  }
  return p;
}

const ALLOWED_PREFIXES = [
  "npm ",
  "npx ",
  "node ",
  "python3 ",
  "git status",
  "git diff",
  "ls",
  "pwd",
];

function runOp(workspace, payload) {
  const op = payload.op;
  if (op === "read_file") {
    const p = resolveInWorkspace(workspace, payload.path);
    return { ok: true, content: fs.readFileSync(p, "utf8") };
  }
  if (op === "write_file") {
    const p = resolveInWorkspace(workspace, payload.path);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, payload.content ?? "", "utf8");
    return { ok: true, path: payload.path };
  }
  if (op === "list_dir") {
    const p = resolveInWorkspace(workspace, payload.path || ".");
    const names = fs.readdirSync(p);
    return { ok: true, entries: names };
  }
  if (op === "run_command") {
    const cmd = (payload.command || "").trim();
    const allowed = ALLOWED_PREFIXES.some((x) => cmd.startsWith(x));
    if (!allowed) throw new Error("command not allowed");
    const cwd = resolveInWorkspace(workspace, payload.cwd || ".");
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, { shell: true, cwd });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("close", (code) =>
        resolve({ ok: code === 0, stdout, stderr, exit_code: code })
      );
      child.on("error", reject);
    });
  }
  throw new Error(`unknown op: ${op}`);
}

async function cmdRegister(args) {
  const base =
    args.url || process.env.MOTORSAI_URL || "https://motorsai.app";
  const workspace = args.workspace || process.cwd();
  const data = await httpJson(`${base.replace(/\/$/, "")}/api/chat/bridge/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_name: args.name || require("os").hostname(),
      workspace_hint: workspace,
    }),
  });
  saveConfig({
    base,
    bridge_id: data.bridge_id,
    secret: data.secret,
    workspace,
  });
  console.log("Registered:", data.bridge_id);
  console.log("Config:", CONFIG_PATH);
}

async function cmdPollLoop() {
  const cfg = loadConfig();
  if (!cfg.bridge_id || !cfg.secret) {
    console.error("Run: motors-pc-bridge register --url https://motorsai.app");
    process.exit(1);
  }
  const base = cfg.base || "https://motorsai.app";
  const workspace = cfg.workspace || process.cwd();
  console.log("Polling as", cfg.bridge_id, "workspace", workspace);

  while (true) {
    try {
      const url = `${base}/api/chat/bridge/poll?bridge_id=${encodeURIComponent(cfg.bridge_id)}&secret=${encodeURIComponent(cfg.secret)}`;
      const data = await httpJson(url);
      if (data.task) {
        const { task_id, payload } = data.task;
        let result;
        let ok = true;
        try {
          result = await runOp(workspace, payload);
        } catch (e) {
          ok = false;
          result = { error: e.message };
        }
        await httpJson(`${base}/api/chat/bridge/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bridge_id: cfg.bridge_id,
            secret: cfg.secret,
            task_id,
            ok,
            result,
          }),
        });
        console.log("Task", task_id, ok ? "ok" : "err", payload.op);
      }
    } catch (e) {
      console.error("poll error:", e.message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (rest[i]?.startsWith("--")) args[rest[i].slice(2)] = rest[i + 1];
  }
  if (cmd === "register") await cmdRegister(args);
  else if (cmd === "poll") await cmdPollLoop();
  else {
    console.log(`Usage:
  motors-pc-bridge register --url https://motorsai.app [--workspace /path]
  motors-pc-bridge poll`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
