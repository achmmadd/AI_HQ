/**
 * Read-only proxy naar n8n REST API (workflowlijst).
 * Vereist N8N_API_KEY; basis-URL via N8N_BASE_URL | N8N_URL (default http://127.0.0.1:5678).
 */

export type N8nWorkflowSummary = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
};

function n8nBaseUrl(): string {
  const raw =
    process.env.N8N_BASE_URL?.trim() ||
    process.env.N8N_URL?.trim() ||
    "http://127.0.0.1:5678";
  return raw.replace(/\/$/, "");
}

export function getN8nApiKey(): string | undefined {
  const k = process.env.N8N_API_KEY?.trim();
  return k || undefined;
}

export async function fetchN8nWorkflowSummaries(): Promise<{
  ok: true;
  workflows: N8nWorkflowSummary[];
  baseUrl: string;
}> {
  const apiKey = getN8nApiKey();
  if (!apiKey) {
    throw new Error("N8N_API_KEY ontbreekt");
  }
  const base = n8nBaseUrl();
  const res = await fetch(`${base}/api/v1/workflows`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-N8N-API-KEY": apiKey,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`n8n HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const data: unknown = await res.json();
  const list = Array.isArray(data)
    ? data
    : data &&
        typeof data === "object" &&
        "data" in data &&
        Array.isArray((data as { data: unknown }).data)
      ? (data as { data: unknown[] }).data
      : [];
  const workflows: N8nWorkflowSummary[] = list.map((w: unknown) => {
    const o = w as Record<string, unknown>;
    const id = o.id != null ? String(o.id) : "";
    const name = typeof o.name === "string" ? o.name : "";
    const active = Boolean(o.active);
    const updatedAt =
      typeof o.updatedAt === "string"
        ? o.updatedAt
        : typeof o.updated_at === "string"
          ? o.updated_at
          : null;
    return { id, name, active, updatedAt };
  });
  return { ok: true, workflows, baseUrl: base };
}
