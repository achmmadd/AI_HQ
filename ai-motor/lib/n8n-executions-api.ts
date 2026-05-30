import { getN8nBaseUrl } from "@/lib/dependency-checks";

export type N8nExecution = {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  startedAt?: string;
  stoppedAt?: string;
  mode?: string;
};

export type N8nExecutionsResult = {
  ok: boolean;
  executions: N8nExecution[];
  error?: string;
  source: "n8n" | "fallback";
};

export async function fetchN8nExecutions(
  limit = 30
): Promise<N8nExecutionsResult> {
  const base = getN8nBaseUrl();
  const apiKey = process.env.N8N_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      executions: [],
      error: "N8N_API_KEY niet gezet — n8n executions niet beschikbaar.",
      source: "fallback",
    };
  }

  try {
    const url = `${base}/api/v1/executions?limit=${Math.min(100, Math.max(1, limit))}`;
    const res = await fetch(url, {
      headers: {
        "X-N8N-API-KEY": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        ok: false,
        executions: [],
        error: `n8n HTTP ${res.status}`,
        source: "fallback",
      };
    }

    const data = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };

    const executions: N8nExecution[] = (data.data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      workflowId: String(row.workflowId ?? ""),
      workflowName:
        typeof row.workflowName === "string" ? row.workflowName : undefined,
      status: String(row.status ?? (row.finished ? "success" : "unknown")),
      startedAt:
        typeof row.startedAt === "string" ? row.startedAt : undefined,
      stoppedAt:
        typeof row.stoppedAt === "string" ? row.stoppedAt : undefined,
      mode: typeof row.mode === "string" ? row.mode : undefined,
    }));

    return { ok: true, executions, source: "n8n" };
  } catch (e) {
    return {
      ok: false,
      executions: [],
      error: e instanceof Error ? e.message : "n8n niet bereikbaar",
      source: "fallback",
    };
  }
}
