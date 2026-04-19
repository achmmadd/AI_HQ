import { NextResponse } from "next/server";
import type { ServiceStatus } from "@/lib/types";

async function ok(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const difyBase = process.env.DIFY_BASE_URL?.replace(/\/$/, "");
  const difyHealth = difyBase
    ? await ok(`${difyBase}/console/api/setup`)
    : false;

  const body: ServiceStatus = {
    n8n: await ok("http://127.0.0.1:5678/healthz"),
    qdrant: await ok("http://127.0.0.1:6333/healthz"),
    ollama: await ok("http://127.0.0.1:11434/api/tags"),
    dify: difyHealth || (difyBase ? await ok(`${difyBase}/v1/chat-messages`, { method: "POST" }) : false),
  };

  return NextResponse.json(body);
}
