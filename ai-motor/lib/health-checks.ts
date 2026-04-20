import { N8N_FACTORY_WEBHOOK } from "@/lib/chat-n8n";

const TIMEOUT_MS = 5_000;

function getDifyBaseUrl(): string {
  return (
    process.env.DIFY_BASE_URL ||
    process.env.DIFY_CODE_INTERPRETER_BASE_URL ||
    "http://127.0.0.1:5001"
  ).replace(/\/$/, "");
}

/** Basis-URL van n8n (voor /healthz), afgeleid uit webhook of env. */
export function getN8nBaseUrl(): string {
  const explicit = process.env.N8N_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    const u = new URL(N8N_FACTORY_WEBHOOK);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://127.0.0.1:5678";
  }
}

async function probe(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export type DependencyCheck = {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  url_host: string;
  error?: string;
};

/**
 * Lichte checks (geen secrets in output). Dify: console setup endpoint reageert als de API leeft.
 */
export async function runDependencyChecks(): Promise<{
  n8n: DependencyCheck;
  dify: DependencyCheck;
}> {
  const n8nBase = getN8nBaseUrl();
  const n8nHealth = `${n8nBase}/healthz`;
  const n8nResult = await probe(n8nHealth, { method: "GET" });

  const difyBase = getDifyBaseUrl();
  const difyPing = `${difyBase}/console/api/setup`;
  const difyResult = await probe(difyPing, { method: "GET" });

  return {
    n8n: {
      name: "n8n",
      ok: n8nResult.ok && n8nResult.status >= 200 && n8nResult.status < 400,
      status: n8nResult.status,
      ms: n8nResult.ms,
      url_host: (() => {
        try {
          return new URL(n8nBase).host;
        } catch {
          return n8nBase;
        }
      })(),
      error: n8nResult.error,
    },
    dify: {
      name: "dify",
      ok: difyResult.ok || difyResult.status === 401,
      status: difyResult.status,
      ms: difyResult.ms,
      url_host: (() => {
        try {
          return new URL(difyBase).host;
        } catch {
          return difyBase;
        }
      })(),
      error: difyResult.error,
    },
  };
}
