/**
 * P2 headless NUC orchestrator contract.
 *
 * Human UI uses PILOT_P2_ACL. The NUC uses PILOT_P2_ORCHESTRATOR_ACL only.
 * Identity is Tailscale WhoIs StableID (or WhoIs Node.ID when it is n…CNTRL).
 * Hostname, IP, client headers and forwarded headers are never authority.
 */

import { parseAcl, type PilotAcl } from "./server.ts";
import { HOME_TENANT_ID } from "./p1-foundation.ts";
import { P2_PINNED_ORIGIN } from "./p2-bind.ts";

export const NUC_ORCHESTRATOR_STABLE_ID = "nkcmY58XEw11CNTRL";
export const P2_ORCHESTRATOR_HEALTH_PATH = "/motor/orchestrator/health";
export const P2_ORCHESTRATOR_READY_PATH = "/motor/orchestrator/ready";
export const P2_ORCHESTRATOR_ENABLE_ENV = "MOTOR_P2_ORCHESTRATOR";

export const P2_ORCHESTRATOR_HEALTH_URL = `${P2_PINNED_ORIGIN}/orchestrator/health`;
export const P2_ORCHESTRATOR_READY_URL = `${P2_PINNED_ORIGIN}/orchestrator/ready`;

const STABLE_ID = /^n[A-Za-z0-9]+CNTRL$/;

export function isStableNodeId(value: string): boolean {
  return STABLE_ID.test(value);
}

export function designedOrchestratorAcl(): PilotAcl {
  return { [NUC_ORCHESTRATOR_STABLE_ID]: [HOME_TENANT_ID] };
}

export function parseOrchestratorAcl(raw: string | undefined): PilotAcl {
  return parseAcl(raw);
}

export function orchestratorAllowed(stableId: string, acl: PilotAcl): boolean {
  if (!isStableNodeId(stableId)) return false;
  const workspaces = acl[stableId];
  return Boolean(workspaces && workspaces.includes(HOME_TENANT_ID));
}

export function whoisStableId(node: { StableID?: string; ID?: string } | undefined): string | null {
  const stable = node?.StableID;
  if (typeof stable === "string" && isStableNodeId(stable)) return stable;
  const id = node?.ID;
  if (typeof id === "string" && isStableNodeId(id)) return id;
  return null;
}

export function orchestratorBody(): { ok: true } {
  return { ok: true };
}

export function orchestratorBodyLeaks(body: unknown): boolean {
  const blob = JSON.stringify(body);
  return (
    blob.includes("context") ||
    blob.includes("draft") ||
    blob.includes("secret") ||
    blob.includes("acl") ||
    blob.includes("review") ||
    blob.includes("evidence") ||
    blob.includes("tenant") ||
    blob.includes(NUC_ORCHESTRATOR_STABLE_ID)
  );
}

export type OrchestratorProbeDecision =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: "empty" | "disabled" | "not_pinned" | "wrong_route" };

export function evaluateOrchestratorProbe(raw: string | undefined, enabled: boolean): OrchestratorProbeDecision {
  if (!enabled) return { ok: false, reason: "disabled" };
  if (!raw || raw.trim().length === 0) return { ok: false, reason: "empty" };
  const normalized = raw.trim().replace(/\/+$/, "");
  if (normalized === P2_ORCHESTRATOR_HEALTH_URL || normalized === P2_ORCHESTRATOR_READY_URL) {
    return { ok: true, url: normalized };
  }
  try {
    const path = new URL(raw).pathname.replace(/\/+$/, "") || "/";
    if (!path.startsWith("/motor/orchestrator/")) return { ok: false, reason: "wrong_route" };
  } catch {
    return { ok: false, reason: "not_pinned" };
  }
  return { ok: false, reason: "not_pinned" };
}
