import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { runDependencyChecks } from "@/lib/dependency-checks";
import { getN8nApiKey } from "@/lib/n8n-workflows-api";
import { getCodeExecutorStatus } from "@/lib/code-executor";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";

export const runtime = "nodejs";

function bookkeepingBase(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

async function probeBookkeeping(): Promise<{
  ok: boolean;
  pending_approvals?: number;
  retry_queue?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${bookkeepingBase()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    const j = (await res.json()) as {
      pending_approvals?: number;
      retry_queue?: number;
    };
    return {
      ok: res.ok,
      pending_approvals: j.pending_approvals,
      retry_queue: j.retry_queue,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unreachable",
    };
  }
}

async function probeOdoo(): Promise<{
  configured: boolean;
  ok: boolean;
  http_status?: number;
  host?: string;
  error?: string;
}> {
  const raw =
    process.env.ODOO_URL?.trim() || process.env.ODOO_BASE_URL?.trim();
  if (!raw) {
    return { configured: false, ok: false };
  }
  const base = raw.replace(/\/$/, "");
  try {
    const u = new URL(base);
    const res = await fetch(`${base}/web`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    return {
      configured: true,
      ok: res.status > 0 && res.status < 500,
      http_status: res.status,
      host: u.host,
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      error: e instanceof Error ? e.message : "error",
    };
  }
}

function pm2LogTail(): string[] {
  const home = process.env.HOME || "/home/pietje";
  const candidates = [
    path.join(home, ".pm2/logs/ai-motor-out.log"),
    path.join(home, ".pm2/logs/ai-motor-out-0.log"),
  ];
  const p = candidates.find((candidate) => existsSync(candidate));
  if (!p) return [];
  try {
    const raw = readFileSync(p, "utf8");
    return raw.trimEnd().split("\n").slice(-35);
  } catch {
    return [];
  }
}

function pm2PidHint(): {
  out_log_exists: boolean;
  pid_file_exists: boolean;
  out_log_path: string | null;
  pid_path: string | null;
} {
  const home = process.env.HOME || "/home/pietje";
  const outLogs = [
    path.join(home, ".pm2/logs/ai-motor-out.log"),
    path.join(home, ".pm2/logs/ai-motor-out-0.log"),
  ];
  const pids = [
    path.join(home, ".pm2/pids/ai-motor-0.pid"),
    path.join(home, ".pm2/pids/ai-motor.pid"),
  ];
  const outLog = outLogs.find((candidate) => existsSync(candidate)) || null;
  const pid = pids.find((candidate) => existsSync(candidate)) || null;
  return {
    out_log_exists: outLog !== null,
    pid_file_exists: pid !== null,
    out_log_path: outLog,
    pid_path: pid,
  };
}

/**
 * Ingelogde read-only status (Mission Control). Geen shell/exec, geen secrets.
 * `?extended=1`: extra bookkeeping, odoo, pm2 log-tail (dev panel).
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  const deps = await runDependencyChecks();
  const checksMs = Date.now() - started;
  const extended =
    new URL(req.url).searchParams.get("extended") === "1";

  const base = {
    service: "ai-motor",
    nodeEnv: process.env.NODE_ENV ?? "development",
    appVersion: process.env.NEXT_PUBLIC_VERSION?.trim() || null,
    processUptimeSec: Math.round(process.uptime() * 10) / 10,
    checksMs,
    dependencies: {
      n8n: {
        ok: deps.n8n.ok,
        http_status: deps.n8n.status,
        latency_ms: deps.n8n.ms,
        host: deps.n8n.url_host,
        ...(deps.n8n.error ? { error: deps.n8n.error } : {}),
      },
      dify: {
        ok: deps.dify.ok,
        http_status: deps.dify.status,
        latency_ms: deps.dify.ms,
        host: deps.dify.url_host,
        ...(deps.dify.error ? { error: deps.dify.error } : {}),
      },
      qdrant: {
        ok: deps.qdrant.ok,
        http_status: deps.qdrant.status,
        latency_ms: deps.qdrant.ms,
        host: deps.qdrant.url_host,
        ...(deps.qdrant.error ? { error: deps.qdrant.error } : {}),
      },
      ollama: {
        ok: deps.ollama.ok,
        http_status: deps.ollama.status,
        latency_ms: deps.ollama.ms,
        host: deps.ollama.url_host,
        ...(deps.ollama.error ? { error: deps.ollama.error } : {}),
      },
    },
    integrations: {
      n8n_rest_api_configured: Boolean(getN8nApiKey()),
    },
    overallOk:
      deps.n8n.ok && deps.dify.ok && deps.qdrant.ok && deps.ollama.ok,
  };

  if (!extended) {
    return NextResponse.json(base);
  }

  async function probeOpenRouter(): Promise<{
    configured: boolean;
    ok: boolean;
    latency_ms?: number;
  }> {
    if (!isOpenRouterDirectConfigured()) {
      return { configured: false, ok: false };
    }
    const started = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!.trim()}`,
        },
        signal: AbortSignal.timeout(8_000),
      });
      return {
        configured: true,
        ok: res.ok,
        latency_ms: Date.now() - started,
      };
    } catch {
      return { configured: true, ok: false, latency_ms: Date.now() - started };
    }
  }

  const deployMissing: string[] = [];
  if (!process.env.GITHUB_TOKEN?.trim()) deployMissing.push("GITHUB_TOKEN");
  if (!process.env.VERCEL_TOKEN?.trim()) deployMissing.push("VERCEL_TOKEN");

  const [bookkeeping, odoo, openrouter, executor] = await Promise.all([
    probeBookkeeping(),
    probeOdoo(),
    probeOpenRouter(),
    getCodeExecutorStatus(),
  ]);

  return NextResponse.json({
    ...base,
    bookkeeping,
    odoo,
    pm2: pm2PidHint(),
    log_tail: pm2LogTail(),
    platform: {
      openrouter,
      executor,
      deploy: {
        ready: deployMissing.length === 0,
        missing: deployMissing,
      },
    },
  });
}
