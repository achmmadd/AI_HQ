import { NextResponse } from "next/server";
import { runDependencyChecks } from "@/lib/dependency-checks";

export const runtime = "nodejs";

/**
 * Publieke maar geen-geheimen-lekkende dependency-check voor de UI-dashboard.
 * ( `/api/health` blijft minimaal i.v.m. bestaande monitoring. )
 */
export async function GET() {
  const started = Date.now();
  const deps = await runDependencyChecks();
  const allOk =
    deps.n8n.ok && deps.dify.ok && deps.qdrant.ok && deps.ollama.ok;

  return NextResponse.json(
    {
      ok: allOk,
      service: "ai-motor",
      uptime_check_ms: Date.now() - started,
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
        openclaw: {
          configured: deps.openclaw.configured,
          ok: deps.openclaw.ok,
          host: deps.openclaw.url_host,
          ...(deps.openclaw.error ? { error: deps.openclaw.error } : {}),
        },
      },
    },
    { status: allOk ? 200 : 503 },
  );
}
