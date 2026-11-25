/**
 * ADR-110 proof — Action Gateway tests (acceptance criterion 4):
 * an external action without a Gateway decision + receipt is technically
 * impossible; forged, absent, expired, mismatched or reused receipts fail.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  argumentHashOf,
  createGateway,
  evaluatePolicy,
} from "./gateway.ts";
import type { Approval, GatewayReceipt } from "./gateway.ts";
import { buildProofFixture, T1, T2, T3 } from "./scenario.ts";
import {
  ADR110_SCHEMA_VERSION,
  branded,
  isoTimestamp,
} from "./types.ts";
import type { ActionId, ActionRequest, IsoTimestamp, TaskId } from "./types.ts";

const fixture = buildProofFixture();
const gateway = createGateway(fixture.policy);

function makeRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
  return {
    schema_version: ADR110_SCHEMA_VERSION,
    action_id: branded<ActionId>("act-1"),
    workspace_id: fixture.task.workspace_id,
    task_id: fixture.task.task_id,
    run_id: branded("run-g1"),
    attempt_id: branded("att-g1"),
    capability: "draft.generate",
    tool: "model.invoke",
    args: { prompt: "draft a reply", seed: 1 },
    data_class: "internal",
    estimated_cost_cents: 10,
    requested_by: fixture.employee.employee_id,
    requested_at: T1,
    ...overrides,
  };
}

const publishApproval: Approval = {
  approval_id: "appr-1",
  capability: "review.reply.publish",
  task_id: fixture.task.task_id,
  approved_by: fixture.identity.identity_id as string,
  expires_at: isoTimestamp("2026-08-15T00:00:00.000Z"),
};

describe("evaluate(policy, request)", () => {
  it("ALLOWs an R0 capability within budget and data class", () => {
    const r = evaluatePolicy(fixture.policy, makeRequest(), T1);
    assert.equal(r.decision, "ALLOW");
  });

  it("DENYs an unknown capability", () => {
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ capability: "crm.write" }),
      T1,
    );
    assert.equal(r.decision, "DENY");
  });

  it("DENYs when the estimated cost exceeds the budget", () => {
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ estimated_cost_cents: 101 }),
      T1,
    );
    assert.equal(r.decision, "DENY");
  });

  it("DENYs a disallowed data class", () => {
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ data_class: "restricted" }),
      T1,
    );
    assert.equal(r.decision, "DENY");
  });

  it("DENYs a cross-workspace request", () => {
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ workspace_id: fixture.cross_workspace_item.scope.workspace_id }),
      T1,
    );
    assert.equal(r.decision, "DENY");
  });

  it("REQUIRE_APPROVAL for an R2 capability without approval", () => {
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ capability: "review.reply.publish", tool: "http.post" }),
      T1,
    );
    assert.equal(r.decision, "REQUIRE_APPROVAL");
  });

  it("ALLOWs an R2 capability with a valid approval", () => {
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ capability: "review.reply.publish", tool: "http.post" }),
      T1,
      [publishApproval],
    );
    assert.equal(r.decision, "ALLOW");
  });

  it("REQUIRE_APPROVAL when the approval is expired", () => {
    const expired: Approval = {
      ...publishApproval,
      expires_at: isoTimestamp("2026-08-13T00:00:00.000Z"),
    };
    const r = evaluatePolicy(
      fixture.policy,
      makeRequest({ capability: "review.reply.publish", tool: "http.post" }),
      T1,
      [expired],
    );
    assert.equal(r.decision, "REQUIRE_APPROVAL");
  });
});

describe("receipt-gated execution", () => {
  it("mints a receipt only after an ALLOW decision", () => {
    const denied = gateway.mintReceipt(
      makeRequest({ capability: "review.reply.publish", tool: "http.post" }),
      T1,
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.decision, "REQUIRE_APPROVAL");

    const minted = gateway.mintReceipt(makeRequest(), T1);
    assert.equal(minted.ok, true);
  });

  it("executes with a valid receipt (happy path, single use)", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-happy") });
    const minted = gateway.mintReceipt(request, T1);
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const executed = gateway.executeAction(request, minted.receipt, T2);
    assert.equal(executed.executed, true, JSON.stringify(executed));
    if (executed.executed) {
      assert.equal(executed.settlement.receipt_id, minted.receipt.receipt_id);
    }
    const replay = gateway.executeAction(request, minted.receipt, T3);
    assert.equal(replay.executed, false);
    if (!replay.executed) assert.equal(replay.reason, "receipt_already_used");
  });

  it("an absent receipt is denied", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-absent") });
    const result = gateway.executeAction(request, null, T1);
    assert.equal(result.executed, false);
    if (!result.executed) assert.equal(result.reason, "receipt_required");
  });

  it("a forged receipt (well-formed shape, never minted) is denied", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-forged") });
    const forged = {
      capability: request.capability,
      tool: request.tool,
      argument_hash: argumentHashOf(request.args),
      task_id: request.task_id,
      run_id: request.run_id,
      attempt_id: request.attempt_id,
      receipt_id: "rcpt-forged",
      minted_at: T1,
      expires_at: isoTimestamp("2026-08-15T00:00:00.000Z"),
    } as unknown as GatewayReceipt;
    const result = gateway.executeAction(request, forged, T1);
    assert.equal(result.executed, false);
    if (!result.executed) {
      assert.equal(result.reason, "receipt_not_minted_by_this_gateway");
    }
  });

  it("a cloned receipt (copied fields, new object identity) is denied", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-clone") });
    const minted = gateway.mintReceipt(request, T1);
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const clone = { ...minted.receipt } as GatewayReceipt;
    const result = gateway.executeAction(request, clone, T1);
    assert.equal(result.executed, false);
    if (!result.executed) {
      assert.equal(result.reason, "receipt_not_minted_by_this_gateway");
    }
  });

  it("an expired receipt is denied", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-expired") });
    const minted = gateway.mintReceipt(request, T1, { ttl_ms: 1_000 });
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const later: IsoTimestamp = isoTimestamp("2026-08-14T00:01:01.000Z");
    const result = gateway.executeAction(request, minted.receipt, later);
    assert.equal(result.executed, false);
    if (!result.executed) assert.equal(result.reason, "receipt_expired");
  });

  it("re-checks the argument hash right before execution", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-tamper") });
    const minted = gateway.mintReceipt(request, T1);
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const tampered = makeRequest({
      action_id: branded<ActionId>("act-tamper"),
      args: { prompt: "PUBLISH EVERYTHING", seed: 1 },
    });
    const result = gateway.executeAction(tampered, minted.receipt, T1);
    assert.equal(result.executed, false);
    if (!result.executed) assert.equal(result.reason, "argument_hash_mismatch");
  });

  it("rejects a receipt used for a different tool", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-tool") });
    const minted = gateway.mintReceipt(request, T1);
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const otherTool = makeRequest({
      action_id: branded<ActionId>("act-tool"),
      tool: "http.post",
    });
    const result = gateway.executeAction(otherTool, minted.receipt, T1);
    assert.equal(result.executed, false);
    if (!result.executed) assert.equal(result.reason, "tool_mismatch");
  });

  it("rejects a receipt bound to a different task", () => {
    const request = makeRequest({ action_id: branded<ActionId>("act-causal") });
    const minted = gateway.mintReceipt(request, T1);
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    const otherTask = makeRequest({
      action_id: branded<ActionId>("act-causal"),
      task_id: branded<TaskId>("task-other"),
    });
    const result = gateway.executeAction(otherTask, minted.receipt, T1);
    assert.equal(result.executed, false);
    if (!result.executed) assert.equal(result.reason, "causal_mismatch");
  });

  it("executes an approval-gated action with approval + receipt", () => {
    const request = makeRequest({
      action_id: branded<ActionId>("act-publish"),
      capability: "review.reply.publish",
      tool: "http.post",
      args: { review_id: 42, body: "concept" },
      estimated_cost_cents: 5,
    });
    const minted = gateway.mintReceipt(request, T1, {
      approvals: [publishApproval],
    });
    assert.equal(minted.ok, true, JSON.stringify(minted));
    if (!minted.ok) return;
    const executed = gateway.executeAction(request, minted.receipt, T2, [
      publishApproval,
    ]);
    assert.equal(executed.executed, true, JSON.stringify(executed));
  });
});

// Compile-time proof: a receipt literal cannot be constructed outside the
// Gateway — the brand is unforgeable at the type level.
// @ts-expect-error receipt literals are not constructible outside gateway.ts
const forgedLiteral: GatewayReceipt = {
  receipt_id: "rcpt-x",
  capability: "draft.generate",
  tool: "model.invoke",
  argument_hash: argumentHashOf({}),
  task_id: fixture.task.task_id,
  run_id: branded("run-x"),
  attempt_id: branded("att-x"),
  minted_at: T1,
  expires_at: T2,
};
void forgedLiteral;
