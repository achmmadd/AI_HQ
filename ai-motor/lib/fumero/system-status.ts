import db from "@/lib/db/database";
import { runDependencyChecks } from "@/lib/dependency-checks";
import { fetchLocalExecutorHealth } from "@/lib/local-executor";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";
import { getFumeroIntegrationReadiness } from "@/lib/fumero/integration-readiness";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";

export type SystemStatusLevel =
  | "operational"
  | "degraded"
  | "down"
  | "config_required";

export type SystemCheck = {
  id: string;
  label: string;
  ok: boolean;
  status: "ok" | "warning" | "error" | "config_required";
  hint?: string;
};

export type FumeroSystemStatus = {
  ok: boolean;
  level: SystemStatusLevel;
  label: string;
  checked_at: string;
  checks: SystemCheck[];
  automation_success_pct: number | null;
  automation_runs_sampled: number;
};

function automationSuccessPct(): { pct: number | null; sampled: number } {
  const keys = Array.from(FUMERO_TASK_KEYS);
  if (keys.length === 0) return { pct: null, sampled: 0 };
  const placeholders = keys.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT r.status
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE t.task_key IN (${placeholders})
       ORDER BY r.id DESC
       LIMIT 50`
    )
    .all(...keys) as Array<{ status: string }>;
  if (rows.length === 0) return { pct: null, sampled: 0 };
  const success = rows.filter((r) => r.status === "success").length;
  return { pct: Math.round((success / rows.length) * 100), sampled: rows.length };
}

function statusLabel(level: SystemStatusLevel): string {
  switch (level) {
    case "operational":
      return "Operationeel";
    case "degraded":
      return "Beperkt";
    case "config_required":
      return "Configuratie vereist";
    case "down":
      return "Storing";
  }
}

export async function buildFumeroSystemStatus(): Promise<FumeroSystemStatus> {
  const checked_at = new Date().toISOString();
  const checks: SystemCheck[] = [];

  let dbOk = true;
  try {
    await ensureFumeroSchemaAsync();
    checks.push({ id: "database", label: "Database", ok: true, status: "ok" });
  } catch (e) {
    dbOk = false;
    const hint = e instanceof Error ? e.message : String(e);
    checks.push({
      id: "database",
      label: "Database",
      ok: false,
      status: "error",
      hint,
    });
  }

  const deps = await runDependencyChecks();
  const executor = await fetchLocalExecutorHealth();
  const openrouterOk = isOpenRouterDirectConfigured();
  const integrations = getFumeroIntegrationReadiness();
  const { pct, sampled } = automationSuccessPct();

  checks.push({
    id: "ai_runtime",
    label: "AI-runtime (OpenRouter)",
    ok: openrouterOk,
    status: openrouterOk ? "ok" : "config_required",
    hint: openrouterOk ? undefined : "OpenRouter API-key ontbreekt",
  });

  checks.push({
    id: "executor",
    label: "Code-executor",
    ok: !executor.configured || executor.reachable,
    status:
      !executor.configured
        ? "warning"
        : executor.reachable
          ? "ok"
          : "error",
    hint: executor.configured
      ? executor.reachable
        ? undefined
        : executor.error ?? "Executor niet bereikbaar"
      : "Executor niet geconfigureerd (optioneel)",
  });

  if (deps.openclaw.configured) {
    checks.push({
      id: "openclaw",
      label: "OpenClaw",
      ok: deps.openclaw.ok,
      status: deps.openclaw.ok ? "ok" : "warning",
      hint: deps.openclaw.ok ? undefined : deps.openclaw.error ?? "OpenClaw offline",
    });
  }

  for (const miss of integrations.missing) {
    checks.push({
      id: miss.id,
      label: miss.label,
      ok: false,
      status: "config_required",
      hint: `${miss.required_for} — stel ${miss.env_keys.join(", ")} in op de server`,
    });
  }

  if (sampled > 0 && pct !== null) {
    checks.push({
      id: "automations",
      label: "Automatiseringen (recent)",
      ok: pct >= 50,
      status: pct >= 70 ? "ok" : pct >= 40 ? "warning" : "error",
      hint: `${pct}% geslaagd (${sampled} runs)`,
    });
  }

  let level: SystemStatusLevel = "operational";
  if (!dbOk) {
    level = "down";
  } else if (integrations.missing.length > 0) {
    level = "config_required";
  } else if (
    checks.some((c) => c.status === "error") ||
    (pct !== null && pct < 40)
  ) {
    level = "degraded";
  } else if (checks.some((c) => c.status === "warning" || c.status === "config_required")) {
    level = "degraded";
  }

  const ok = level === "operational";

  return {
    ok,
    level,
    label: statusLabel(level),
    checked_at,
    checks,
    automation_success_pct: pct,
    automation_runs_sampled: sampled,
  };
}
