/**
 * MCP read policy — the Motor-side authority for the MCP boundary.
 *
 * MCP annotations (readOnlyHint etc.) are hints for clients; they enforce
 * nothing. Enforcement lives here: exactly one capability is known to this
 * policy (`run.snapshot.read`, R0, internal, no network, no budget). Every
 * other capability — write, publish, mail, payment, device-control — is
 * unknown to the gateway and therefore DENY by construction.
 */

import {
  ADR110_SCHEMA_VERSION,
  branded,
  deepFreeze,
} from "../../lib/adr110/index.ts";
import type { Policy, PolicyId, WorkspaceId } from "../../lib/adr110/index.ts";
import { computePolicyDigest } from "../../lib/adr110/gateway.ts";

export const MCP_READ_CAPABILITY = "run.snapshot.read" as const;
export const MCP_TOOL_NAME = "motor.pilot.read_run_snapshot" as const;

export function buildMcpReadPolicy(workspace_id: WorkspaceId): Policy {
  const policyContent = {
    schema_version: ADR110_SCHEMA_VERSION,
    policy_id: branded<PolicyId>("policy-motor-mcp-readonly"),
    version: "1.0.0",
    workspace_id,
    capabilities: {
      [MCP_READ_CAPABILITY]: {
        risk: "R0",
        requires_approval: false,
        budget_cents_max: 0,
        allowed_data_classes: ["public", "internal"],
        network: "none",
      },
    },
  } as const;
  return deepFreeze({
    ...policyContent,
    digest: computePolicyDigest(policyContent),
  });
}
