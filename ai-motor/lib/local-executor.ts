/**
 * Client for NUC local executor (agent_service on 127.0.0.1:8790).
 */

export type LocalExecutorOp =
  | "read_file"
  | "write_file"
  | "list_dir"
  | "run_command";

export type LocalExecutorRequest = {
  op: LocalExecutorOp;
  path?: string;
  content?: string;
  command?: string;
  cwd?: string;
};

export type LocalExecutorHealth = {
  ok?: boolean;
  service?: string;
  workspace_root?: string;
  workspace_exists?: boolean;
  secret_configured?: boolean;
};

export function isLocalExecutorConfigured(): boolean {
  return Boolean(
    process.env.LOCAL_EXECUTOR_URL?.trim() &&
      process.env.LOCAL_EXECUTOR_SECRET?.trim()
  );
}

export function getLocalExecutorBaseUrl(): string {
  return (process.env.LOCAL_EXECUTOR_URL?.trim() || "http://127.0.0.1:8790")
    .replace(/\/+$/, "");
}

export async function fetchLocalExecutorHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  health: LocalExecutorHealth | null;
  error?: string;
}> {
  if (!isLocalExecutorConfigured()) {
    return { configured: false, reachable: false, health: null };
  }
  const base = getLocalExecutorBaseUrl();
  try {
    const res = await fetch(`${base}/executor/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return {
        configured: true,
        reachable: false,
        health: null,
        error: `HTTP ${res.status}`,
      };
    }
    const health = (await res.json()) as LocalExecutorHealth;
    return { configured: true, reachable: true, health };
  } catch (e) {
    return {
      configured: true,
      reachable: false,
      health: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function callLocalExecutor(
  body: LocalExecutorRequest
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  if (!isLocalExecutorConfigured()) {
    return { ok: false, error: "local_executor_not_configured" };
  }
  const base = getLocalExecutorBaseUrl();
  const secret = process.env.LOCAL_EXECUTOR_SECRET!.trim();
  try {
    const res = await fetch(`${base}/executor/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(
        Number(process.env.LOCAL_EXECUTOR_CLIENT_TIMEOUT_MS || "130000")
      ),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : text || `HTTP ${res.status}`;
      return { ok: false, error: detail, data };
    }
    return { ok: Boolean(data.ok ?? true), data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
