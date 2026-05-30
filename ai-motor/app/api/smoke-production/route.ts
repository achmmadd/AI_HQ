import { NextResponse } from "next/server";
import { runDependencyChecks } from "@/lib/dependency-checks";
import { assertDifyConfigured } from "@/lib/artifact-html";

export const runtime = "nodejs";

/**
 * Publieke productie-smoke: geen secrets, wel booleans voor integrations.
 * Handig voor curl/monitoring buiten ingelogde sessies.
 */
export async function GET() {
  const started = Date.now();
  const deps = await runDependencyChecks();
  const depsOk =
    deps.n8n.ok && deps.dify.ok && deps.qdrant.ok && deps.ollama.ok;

  const gh = Boolean(process.env.GITHUB_TOKEN?.trim());
  const vz = Boolean(process.env.VERCEL_TOKEN?.trim());
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  return NextResponse.json(
    {
      ok: depsOk,
      service: "ai-motor",
      check_ms: Date.now() - started,
      app_version: process.env.NEXT_PUBLIC_VERSION?.trim() || null,
      features: {
        dify_builder_configured: assertDifyConfigured(),
        deploy_configured: gh && vz,
        anthropic_design_research_configured: anthropic,
        motor_password_configured: Boolean(
          process.env.MOTORSAI_PASSWORD?.trim()
        ),
      },
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
    },
    { status: depsOk ? 200 : 503 }
  );
}
