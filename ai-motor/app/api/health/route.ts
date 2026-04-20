import { NextResponse } from "next/server";
import { runDependencyChecks } from "@/lib/health-checks";

export const runtime = "nodejs";

/**
 * Publieke health + dependency smoke (Mission Control–light).
 * Geen API-keys of interne URLs met paden die secrets lekken.
 */
export async function GET() {
  const started = Date.now();
  const deps = await runDependencyChecks();
  const allOk = deps.n8n.ok && deps.dify.ok;

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
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
