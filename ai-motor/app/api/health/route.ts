import { NextResponse } from "next/server";

async function check(url: string, timeout = 4000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  const difyUrl = (process.env.DIFY_BASE_URL || "http://127.0.0.1:5001").replace(
    /\/$/,
    ""
  );
  const ollamaUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
    /\/$/,
    ""
  );
  const qdrantUrl = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
    /\/$/,
    ""
  );

  const [n8n, dify, ollama, qdrant] = await Promise.all([
    check("http://127.0.0.1:5678/healthz"),
    check(`${difyUrl}/console/api/setup`),
    check(`${ollamaUrl}/api/tags`),
    check(`${qdrantUrl}/healthz`),
  ]);

  const allGreen = n8n && dify && ollama && qdrant;

  const payload = {
    status: allGreen ? "healthy" : "degraded" as const,
    timestamp: new Date().toISOString(),
    services: { n8n, dify, ollama, qdrant },
    n8n,
    qdrant,
    ollama,
    dify,
  };

  return NextResponse.json(payload, {
    status: allGreen ? 200 : 207,
  });
}
