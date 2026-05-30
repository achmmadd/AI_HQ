import { N8N_FACTORY_WEBHOOK } from "@/lib/chat-n8n";
import { fetchOpenClawGatewayHealth } from "@/lib/openclaw-gateway";

const TIMEOUT_MS = 3_200;

function getDifyBaseUrl(): string {
  return (
    process.env.DIFY_BASE_URL ||
    process.env.DIFY_CODE_INTERPRETER_BASE_URL ||
    "http://127.0.0.1:5001"
  ).replace(/\/$/, "");
}

function getQdrantBaseUrl(): string {
  return (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
}

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
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
  init?: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
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
  qdrant: DependencyCheck;
  ollama: DependencyCheck;
  openclaw: DependencyCheck & { configured: boolean };
}> {
  const n8nBase = getN8nBaseUrl();
  const n8nHealth = `${n8nBase}/healthz`;
  const difyBase = getDifyBaseUrl();
  const difyPing = `${difyBase}/console/api/setup`;
  const qdrantBase = getQdrantBaseUrl();
  const qdrantHealth = `${qdrantBase}/`;
  const ollamaBase = getOllamaBaseUrl();
  const ollamaPing = `${ollamaBase}/api/tags`;

  const [n8nResult, difyResult, qdrantResult, ollamaResult] = await Promise.all([
    probe(n8nHealth, { method: "GET" }),
    probe(difyPing, { method: "GET" }),
    probe(qdrantHealth, { method: "GET" }),
    probe(ollamaPing, { method: "GET" }),
  ]);

  const oc = await fetchOpenClawGatewayHealth();
  const ocHost = (() => {
    try {
      return new URL(
        process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789"
      ).host;
    } catch {
      return "127.0.0.1:18789";
    }
  })();

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
    qdrant: {
      name: "qdrant",
      ok:
        qdrantResult.ok &&
        qdrantResult.status >= 200 &&
        qdrantResult.status < 500,
      status: qdrantResult.status,
      ms: qdrantResult.ms,
      url_host: (() => {
        try {
          return new URL(qdrantBase).host;
        } catch {
          return qdrantBase;
        }
      })(),
      error: qdrantResult.error,
    },
    ollama: {
      name: "ollama",
      ok: ollamaResult.ok && ollamaResult.status === 200,
      status: ollamaResult.status,
      ms: ollamaResult.ms,
      url_host: (() => {
        try {
          return new URL(ollamaBase).host;
        } catch {
          return ollamaBase;
        }
      })(),
      error: ollamaResult.error,
    },
    openclaw: {
      name: "openclaw",
      configured: oc.configured,
      ok: Boolean(oc.reachable && oc.chatCompletionsEnabled !== false),
      status: oc.reachable ? 200 : 0,
      ms: 0,
      url_host: ocHost,
      error: oc.error,
    },
  };
}
