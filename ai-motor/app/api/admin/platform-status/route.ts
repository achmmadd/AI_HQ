import { NextResponse } from "next/server";
import { getCodeExecutorStatus } from "@/lib/code-executor";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";

export const runtime = "nodejs";

async function probeOpenRouter(): Promise<{
  configured: boolean;
  ok: boolean;
  latency_ms?: number;
  error?: string;
}> {
  const configured = isOpenRouterDirectConfigured();
  if (!configured) {
    return { configured: false, ok: false, error: "OPENROUTER_API_KEY ontbreekt" };
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
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      latency_ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function deployReadiness(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.GITHUB_TOKEN?.trim()) missing.push("GITHUB_TOKEN");
  if (!process.env.VERCEL_TOKEN?.trim()) missing.push("VERCEL_TOKEN");
  return { ready: missing.length === 0, missing };
}

/** Platform readiness: OpenRouter, code executor, deploy tokens. */
export async function GET() {
  const [openrouter, executor] = await Promise.all([
    probeOpenRouter(),
    getCodeExecutorStatus(),
  ]);
  const deploy = deployReadiness();

  return NextResponse.json({
    openrouter,
    executor,
    deploy,
    overallOk:
      openrouter.ok &&
      (executor.nuc.reachable || executor.bridge.online) &&
      deploy.ready,
  });
}
