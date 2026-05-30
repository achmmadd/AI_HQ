import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const MAX_OUTPUT_CHARS = 200_000;
const DEFAULT_TIMEOUT_MS = 120_000;

export function getDefaultTerminalCwd(): string {
  const fromEnv = process.env.MOTORS_TERMINAL_CWD?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const home = os.homedir();
  const candidates = [
    path.join(home, "AI_HQ/ai-motor"),
    path.join(home, "AI_HQ"),
    home,
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return home;
}

function resolveCwd(requested: string | undefined): string {
  const base = getDefaultTerminalCwd();
  const cwd = path.resolve(requested?.trim() || base);
  const home = os.homedir();
  if (!cwd.startsWith(home)) {
    throw new Error("Alleen paden onder je home-directory zijn toegestaan.");
  }
  return cwd;
}

export async function runDevTerminalCommand(opts: {
  command: string;
  cwd?: string;
  timeoutMs?: number;
}): Promise<{
  stdout: string;
  stderr: string;
  exit_code: number | null;
  cwd: string;
  duration_ms: number;
  truncated: boolean;
}> {
  const cmd = opts.command.trim();
  if (!cmd) throw new Error("Leeg commando");

  const cwd = resolveCwd(opts.cwd);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const t0 = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", cmd], {
      cwd,
      env: {
        ...process.env,
        HOME: os.homedir(),
        TERM: "xterm-256color",
        LANG: "en_US.UTF-8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;

    const append = (chunk: string, target: "out" | "err") => {
      const total = stdout.length + stderr.length;
      if (total >= MAX_OUTPUT_CHARS) {
        truncated = true;
        return;
      }
      const slice = chunk.slice(0, MAX_OUTPUT_CHARS - total);
      if (target === "out") stdout += slice;
      else stderr += slice;
    };

    child.stdout?.on("data", (d: Buffer) =>
      append(d.toString("utf8"), "out")
    );
    child.stderr?.on("data", (d: Buffer) =>
      append(d.toString("utf8"), "err")
    );

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exit_code: code,
        cwd,
        duration_ms: Date.now() - t0,
        truncated,
      });
    });
  });
}
