/**
 * ADR-110 Action Gateway (pure proof).
 *
 * evaluate() maps (policy, action request) to ALLOW | DENY | REQUIRE_APPROVAL.
 * executeAction() requires a GatewayReceipt — a branded, opaque type that only
 * mintReceipt() can produce — bound to (tool, argument_hash, task_id,
 * expires_at). Tool and argument hash are re-checked immediately before
 * execution. Receipts are single-use and registered in the Gateway closure;
 * a forged receipt with a well-formed shape but an unknown receipt_id fails.
 *
 * This proof performs no real side effect: a successful executeAction returns
 * a settlement record representing that the Gateway would now invoke the
 * action driver inside its trust boundary.
 */

import { compareIso, isoTimestamp } from "./types.ts";
import type {
  ActionRequest,
  IsoTimestamp,
  Policy,
  PolicyRef,
  Sha256Digest,
} from "./types.ts";
import { deepFreeze, digestOf } from "./digest.ts";

export type GatewayDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface Approval {
  readonly approval_id: string;
  readonly capability: string;
  readonly task_id: ActionRequest["task_id"];
  readonly approved_by: string;
  readonly expires_at: IsoTimestamp;
}

export interface GatewayEvaluation {
  readonly decision: GatewayDecision;
  readonly reasons: readonly string[];
}

/**
 * Module-private brand key. Never exported: receipts cannot be constructed
 * outside this module at the type level, and the Gateway registry rejects
 * forged objects at runtime.
 */
const ReceiptBrand: unique symbol = Symbol("adr110.gateway.receipt");

/**
 * Opaque authorization receipt. The brand makes it impossible to construct
 * outside this module at the type level; the Gateway registry makes forgery
 * fail at runtime.
 */
export interface GatewayReceipt {
  readonly [ReceiptBrand]: true;
  readonly receipt_id: string;
  readonly capability: string;
  readonly tool: string;
  readonly argument_hash: Sha256Digest;
  readonly task_id: ActionRequest["task_id"];
  readonly run_id: ActionRequest["run_id"];
  readonly attempt_id: ActionRequest["attempt_id"];
  readonly minted_at: IsoTimestamp;
  readonly expires_at: IsoTimestamp;
}

export type MintResult =
  | { readonly ok: true; readonly receipt: GatewayReceipt }
  | {
      readonly ok: false;
      readonly decision: Exclude<GatewayDecision, "ALLOW">;
      readonly reasons: readonly string[];
    };

export type ExecutionResult =
  | {
      readonly executed: true;
      readonly settlement: {
        readonly receipt_id: string;
        readonly action_id: string;
        readonly argument_hash: Sha256Digest;
        readonly executed_at: IsoTimestamp;
      };
    }
  | { readonly executed: false; readonly decision: "DENY"; readonly reason: string };

export interface Gateway {
  readonly policy_ref: PolicyRef;
  evaluate(
    request: ActionRequest,
    now: IsoTimestamp,
    approvals?: readonly Approval[],
  ): GatewayEvaluation;
  mintReceipt(
    request: ActionRequest,
    now: IsoTimestamp,
    options?: { readonly ttl_ms?: number; readonly approvals?: readonly Approval[] },
  ): MintResult;
  executeAction(
    request: ActionRequest,
    receipt: GatewayReceipt | null | undefined,
    now: IsoTimestamp,
    approvals?: readonly Approval[],
  ): ExecutionResult;
}

export function policyRefOf(policy: Policy): PolicyRef {
  return deepFreeze({
    policy_id: policy.policy_id,
    version: policy.version,
    digest: policy.digest,
  });
}

/** Digest of a Policy's canonical content, excluding the digest field itself. */
export function computePolicyDigest(policy: Omit<Policy, "digest">): Sha256Digest {
  return digestOf(policy);
}

export function argumentHashOf(args: unknown): Sha256Digest {
  return digestOf(args);
}

export function evaluatePolicy(
  policy: Policy,
  request: ActionRequest,
  now: IsoTimestamp,
  approvals: readonly Approval[] = [],
): GatewayEvaluation {
  const reasons: string[] = [];
  if (request.workspace_id !== policy.workspace_id) {
    return { decision: "DENY", reasons: ["cross-workspace request"] };
  }
  const capability = policy.capabilities[request.capability];
  if (capability === undefined) {
    return {
      decision: "DENY",
      reasons: [`unknown capability: ${request.capability}`],
    };
  }
  if (!capability.allowed_data_classes.includes(request.data_class)) {
    return {
      decision: "DENY",
      reasons: [
        `data_class ${request.data_class} not allowed for ${request.capability}`,
      ],
    };
  }
  if (request.estimated_cost_cents > capability.budget_cents_max) {
    return {
      decision: "DENY",
      reasons: [
        `estimated cost ${request.estimated_cost_cents} exceeds budget ${capability.budget_cents_max}`,
      ],
    };
  }
  const needsApproval = capability.requires_approval || capability.risk !== "R0";
  if (needsApproval) {
    const valid = approvals.some(
      (a) =>
        a.capability === request.capability &&
        a.task_id === request.task_id &&
        compareIso(a.expires_at, now) > 0,
    );
    if (!valid) {
      reasons.push(
        `capability ${request.capability} (risk ${capability.risk}) requires approval`,
      );
      return { decision: "REQUIRE_APPROVAL", reasons };
    }
  }
  return { decision: "ALLOW", reasons };
}

export function createGateway(policy: Policy): Gateway {
  const minted = new Map<string, { readonly receipt: GatewayReceipt; used: boolean }>();
  let receiptCounter = 0;

  const gateway: Gateway = {
    policy_ref: policyRefOf(policy),

    evaluate(request, now, approvals = []) {
      return evaluatePolicy(policy, request, now, approvals);
    },

    mintReceipt(request, now, options = {}) {
      const evaluation = gateway.evaluate(request, now, options.approvals ?? []);
      if (evaluation.decision !== "ALLOW") {
        return {
          ok: false,
          decision: evaluation.decision,
          reasons: evaluation.reasons,
        };
      }
      receiptCounter += 1;
      const ttl = options.ttl_ms ?? 60_000;
      const receipt: GatewayReceipt = deepFreeze({
        [ReceiptBrand]: true,
        receipt_id: `rcpt-${String(receiptCounter)}`,
        capability: request.capability,
        tool: request.tool,
        argument_hash: argumentHashOf(request.args),
        task_id: request.task_id,
        run_id: request.run_id,
        attempt_id: request.attempt_id,
        minted_at: now,
        expires_at: isoTimestamp(
          new Date(Date.parse(now) + ttl).toISOString(),
        ),
      });
      minted.set(receipt.receipt_id, { receipt, used: false });
      return { ok: true, receipt };
    },

    executeAction(request, receipt, now, approvals = []) {
      if (receipt === null || receipt === undefined) {
        return {
          executed: false,
          decision: "DENY",
          reason: "receipt_required",
        };
      }
      const entry = minted.get(receipt.receipt_id);
      if (entry === undefined || entry.receipt !== receipt) {
        return {
          executed: false,
          decision: "DENY",
          reason: "receipt_not_minted_by_this_gateway",
        };
      }
      if (entry.used) {
        return {
          executed: false,
          decision: "DENY",
          reason: "receipt_already_used",
        };
      }
      if (compareIso(receipt.expires_at, now) <= 0) {
        return { executed: false, decision: "DENY", reason: "receipt_expired" };
      }
      if (receipt.tool !== request.tool) {
        return { executed: false, decision: "DENY", reason: "tool_mismatch" };
      }
      // Re-check the argument hash immediately before execution.
      if (receipt.argument_hash !== argumentHashOf(request.args)) {
        return {
          executed: false,
          decision: "DENY",
          reason: "argument_hash_mismatch",
        };
      }
      if (
        receipt.task_id !== request.task_id ||
        receipt.run_id !== request.run_id ||
        receipt.attempt_id !== request.attempt_id
      ) {
        return { executed: false, decision: "DENY", reason: "causal_mismatch" };
      }
      const recheck = gateway.evaluate(request, now, approvals);
      if (recheck.decision !== "ALLOW") {
        return {
          executed: false,
          decision: "DENY",
          reason: `policy_recheck_failed:${recheck.decision}`,
        };
      }
      minted.set(receipt.receipt_id, { receipt, used: true });
      return {
        executed: true,
        settlement: deepFreeze({
          receipt_id: receipt.receipt_id,
          action_id: request.action_id as string,
          argument_hash: receipt.argument_hash,
          executed_at: now,
        }),
      };
    },
  };
  return gateway;
}
