/**
 * Unified executor voor /code — NUC local executor of PC bridge.
 */
import {
  callLocalExecutor,
  fetchLocalExecutorHealth,
  isLocalExecutorConfigured,
  type LocalExecutorRequest,
} from "@/lib/local-executor";
import {
  callBridgeExecutor,
  getActiveBridgeId,
  isBridgeExecutorConfigured,
  isBridgeOnline,
} from "@/lib/bridge-executor";

export type CodeExecutorTarget = "nuc" | "bridge" | "auto";
export type ActiveExecutorTarget = "nuc" | "bridge" | "none";

export function resolveCodeExecutorTarget(
  override?: string | null
): CodeExecutorTarget {
  const raw =
    override?.trim() ||
    process.env.MOTOR_CODE_EXECUTOR?.trim() ||
    "auto";
  if (raw === "bridge") return "bridge";
  if (raw === "nuc") return "nuc";
  return "auto";
}

export async function resolveActiveExecutorTarget(): Promise<ActiveExecutorTarget> {
  const config = resolveCodeExecutorTarget(null);
  const nucHealth = await fetchLocalExecutorHealth();
  const bridgeConfigured = isBridgeExecutorConfigured();
  const bridge_id = bridgeConfigured ? getActiveBridgeId() : null;
  const bridgeOnline = bridge_id ? isBridgeOnline(bridge_id) : false;

  if (config === "bridge") {
    return bridgeOnline ? "bridge" : "none";
  }
  if (config === "nuc") {
    return nucHealth.reachable ? "nuc" : "none";
  }

  if (nucHealth.reachable) return "nuc";
  if (bridgeOnline) return "bridge";
  return "none";
}

export async function callCodeExecutor(
  body: LocalExecutorRequest,
  opts?: { target?: CodeExecutorTarget; bridgeId?: string | null }
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string; via?: string }> {
  const target = opts?.target ?? resolveCodeExecutorTarget(null);

  if (target === "bridge") {
    const bridge = await callBridgeExecutor(body, opts?.bridgeId);
    return { ...bridge, via: "bridge" };
  }

  if (isLocalExecutorConfigured()) {
    const r = await callLocalExecutor(body);
    if (r.ok) return { ...r, via: "nuc" };
    if (target === "nuc") return { ...r, via: "nuc" };
  } else if (target === "nuc") {
    return { ok: false, error: "local_executor_not_configured", via: "nuc" };
  }

  if (isBridgeExecutorConfigured()) {
    const bridge = await callBridgeExecutor(body, opts?.bridgeId);
    return { ...bridge, via: "bridge" };
  }

  return { ok: false, error: "no_executor_available", via: target };
}

export async function getCodeExecutorStatus(): Promise<{
  nuc: { configured: boolean; reachable: boolean };
  bridge: { configured: boolean; online: boolean; bridge_id?: string };
  configured: CodeExecutorTarget;
  active: ActiveExecutorTarget;
}> {
  const nucHealth = await fetchLocalExecutorHealth();
  const bridgeConfigured = isBridgeExecutorConfigured();
  let bridgeOnline = false;
  let bridge_id: string | undefined;
  if (bridgeConfigured) {
    bridge_id = getActiveBridgeId() ?? undefined;
    bridgeOnline = bridge_id ? isBridgeOnline(bridge_id) : false;
  }
  return {
    nuc: {
      configured: nucHealth.configured,
      reachable: nucHealth.reachable,
    },
    bridge: {
      configured: bridgeConfigured,
      online: bridgeOnline,
      bridge_id,
    },
    configured: resolveCodeExecutorTarget(null),
    active: await resolveActiveExecutorTarget(),
  };
}
