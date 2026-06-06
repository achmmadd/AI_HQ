import { getDatabaseUrl } from "@/lib/db/pg-flags";
import {
  runDependencyChecks,
  type DependencyCheck,
} from "@/lib/dependency-checks";
import { getLiteLLMBaseUrl } from "@/lib/model-router";
import { probeQdrantCollections } from "@/lib/qdrant-health";

const PROBE_TIMEOUT_MS = 6_000;

export type HybridServiceCheck = DependencyCheck & {
  configured: boolean;
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function probeUrl(
  url: string,
  okPredicate: (status: number, resOk: boolean) => boolean = (s, r) =>
    r && s >= 200 && s < 400
): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return {
      ok: okPredicate(res.status, res.ok),
      status: res.status,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Postgres ping via DATABASE_URL (Hetzner over Tailscale). */
export async function probePostgres(): Promise<HybridServiceCheck> {
  const url = getDatabaseUrl();
  if (!url) {
    return {
      name: "postgres",
      configured: false,
      ok: false,
      status: 0,
      ms: 0,
      url_host: "",
    };
  }

  const t0 = Date.now();
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      prepare: false,
    });
    await sql`SELECT 1 AS ok`;
    await sql.end({ timeout: 2 });
    return {
      name: "postgres",
      configured: true,
      ok: true,
      status: 200,
      ms: Date.now() - t0,
      url_host: hostFromUrl(url),
    };
  } catch (e) {
    return {
      name: "postgres",
      configured: true,
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      url_host: hostFromUrl(url),
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** LiteLLM sidecar on Hetzner. */
export async function probeLiteLLM(): Promise<HybridServiceCheck> {
  const raw = getLiteLLMBaseUrl();
  if (!raw) {
    return {
      name: "litellm",
      configured: false,
      ok: false,
      status: 0,
      ms: 0,
      url_host: "",
    };
  }

  const base = raw.replace(/\/$/, "");
  const result = await probeUrl(`${base}/health/liveliness`);
  return {
    name: "litellm",
    configured: true,
    ok: result.ok,
    status: result.status,
    ms: result.ms,
    url_host: hostFromUrl(base),
    error: result.error,
  };
}

export type HybridReadiness = {
  docs: string;
  checklist_doc: string;
  tailscale_hostname_hint: string;
  services: {
    postgres: HybridServiceCheck;
    qdrant: HybridServiceCheck;
    ollama: HybridServiceCheck;
    litellm: HybridServiceCheck;
    n8n: HybridServiceCheck;
    dify: HybridServiceCheck;
  };
  /** Core Hetzner backends Motor expects in hybrid prod. */
  hetzner_core_ok: boolean;
  /** All configured Hetzner-side deps reachable (excludes optional unconfigured). */
  all_configured_ok: boolean;
  checklist: Array<{ id: string; label: string; ok: boolean }>;
  smoke_script: string;
};

/**
 * Single response block for NUC→Hetzner hybrid validation (Sprint 3.1).
 */
export async function buildHybridReadiness(
  qdrantCollectionsPrefetched?: Awaited<
    ReturnType<typeof probeQdrantCollections>
  >
): Promise<HybridReadiness> {
  const [deps, postgres, litellm, qdrantCollections] = await Promise.all([
    runDependencyChecks(),
    probePostgres(),
    probeLiteLLM(),
    qdrantCollectionsPrefetched
      ? Promise.resolve(qdrantCollectionsPrefetched)
      : probeQdrantCollections(),
  ]);

  const qdrant: HybridServiceCheck = {
    ...deps.qdrant,
    configured: Boolean(process.env.QDRANT_URL?.trim()),
  };
  const ollama: HybridServiceCheck = {
    ...deps.ollama,
    configured: Boolean(process.env.OLLAMA_URL?.trim()),
  };
  const n8n: HybridServiceCheck = {
    ...deps.n8n,
    configured: Boolean(
      process.env.N8N_BASE_URL?.trim() ||
        process.env.N8N_FACTORY_WEBHOOK?.trim() ||
        process.env.N8N_FACTORY_OS_WEBHOOK?.trim()
    ),
  };
  const dify: HybridServiceCheck = {
    ...deps.dify,
    configured: Boolean(
      process.env.DIFY_BASE_URL?.trim() ||
        process.env.DIFY_API_KEY?.trim()
    ),
  };

  const hetzner_core_ok =
    qdrant.ok &&
    ollama.ok &&
    (postgres.configured ? postgres.ok : true);

  const configuredServices = [postgres, qdrant, ollama, litellm, n8n, dify].filter(
    (s) => s.configured
  );
  const all_configured_ok =
    configuredServices.length > 0 &&
    configuredServices.every((s) => s.ok);

  const checklist = [
    {
      id: "qdrant",
      label: "Qdrant bereikbaar (QDRANT_URL)",
      ok: qdrant.ok,
    },
    {
      id: "ollama",
      label: "Ollama embed bereikbaar (OLLAMA_URL)",
      ok: ollama.ok,
    },
    {
      id: "postgres",
      label: "Postgres bereikbaar (DATABASE_URL)",
      ok: !postgres.configured || postgres.ok,
    },
    {
      id: "litellm",
      label: "LiteLLM proxy (LITELLM_BASE_URL)",
      ok: !litellm.configured || litellm.ok,
    },
    {
      id: "n8n",
      label: "n8n health (N8N_BASE_URL / webhook host)",
      ok: !n8n.configured || n8n.ok,
    },
    {
      id: "dify",
      label: "Dify builder (DIFY_BASE_URL)",
      ok: !dify.configured || dify.ok,
    },
    {
      id: "collections",
      label: "Qdrant collecties met data (dual-search)",
      ok: qdrantCollections.ok,
    },
  ];

  return {
    docs: "docs/hybrid-env.md",
    checklist_doc: "docs/hetzner-migration.md#checklist-na-elke-fase",
    tailscale_hostname_hint: "hetzner-motor",
    services: { postgres, qdrant, ollama, litellm, n8n, dify },
    hetzner_core_ok,
    all_configured_ok,
    checklist,
    smoke_script: "scripts/hybrid-smoke.mjs",
  };
}
