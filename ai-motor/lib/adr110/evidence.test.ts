/**
 * ADR-110 proof — Evidence chain tests (acceptance criterion 3):
 * task → run → attempt → action/artifact → outcome, no orphan records,
 * and unauthorized attempts are recorded as evidence.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidenceChain,
  findOrphans,
  makeEvidenceRecord,
  UNAUTHORIZED_ATTEMPT_KIND,
} from "./evidence.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
  T3,
} from "./scenario.ts";
import { createFakeAlphaAdapter } from "./adapters/fake-alpha.ts";
import { branded } from "./types.ts";
import type { EvidenceId, EvidenceRecord, RunId } from "./types.ts";

const fixture = buildProofFixture();
const run = await runTaskThroughAdapter(
  createFakeAlphaAdapter(),
  fixture,
  createRunIds("a"),
);

describe("buildEvidenceChain / findOrphans", () => {
  it("accepts the full causal chain with zero orphans", () => {
    const built = buildEvidenceChain(run.evidence);
    assert.equal(built.ok, true, JSON.stringify(built));
    assert.deepEqual(findOrphans(run.evidence), []);
  });

  it("flags an injected orphan (unknown parent)", () => {
    const orphan = makeEvidenceRecord({
      evidence_id: branded("ev-orphan"),
      stage: "action",
      task_id: fixture.task.task_id,
      run_id: run.run_id,
      attempt_id: run.attempt_id,
      subject_id: "act-orphan",
      parent_evidence_id: branded<EvidenceId>("ev-does-not-exist"),
      kind_detail: "gateway.decision",
      data: { decision: "ALLOW" },
      occurred_at: T3,
    });
    const records = [...run.evidence, orphan];
    const orphans = findOrphans(records);
    assert.deepEqual(
      orphans.map((o) => o.evidence_id as string),
      ["ev-orphan"],
    );
    assert.equal(buildEvidenceChain(records).ok, false);
  });

  it("flags a record with the wrong predecessor stage", () => {
    const wrongParent = makeEvidenceRecord({
      evidence_id: branded("ev-wrong-parent"),
      stage: "outcome",
      task_id: fixture.task.task_id,
      subject_id: "outcome-x",
      parent_evidence_id: run.evidence[0].evidence_id, // task stage
      kind_detail: "human.review",
      data: { status: "success" },
      occurred_at: T3,
    });
    const orphans = findOrphans([...run.evidence, wrongParent]);
    assert.deepEqual(
      orphans.map((o) => o.evidence_id as string),
      ["ev-wrong-parent"],
    );
  });

  it("flags causal id inconsistency with the parent", () => {
    const inconsistent = makeEvidenceRecord({
      evidence_id: branded("ev-inconsistent"),
      stage: "artifact",
      task_id: fixture.task.task_id,
      run_id: branded<RunId>("run-elsewhere"),
      attempt_id: run.attempt_id,
      subject_id: "artifact-x",
      parent_evidence_id: run.evidence[2].evidence_id, // attempt stage
      kind_detail: "adapter.result",
      data: { output: "x", cost_cents: 1 },
      occurred_at: T3,
    });
    const orphans = findOrphans([...run.evidence, inconsistent]);
    assert.deepEqual(
      orphans.map((o) => o.evidence_id as string),
      ["ev-inconsistent"],
    );
  });

  it("rejects a tampered record (digest mismatch)", () => {
    const original = run.evidence[4];
    const tampered: EvidenceRecord = {
      ...original,
      data: { status: "failure" },
    };
    const built = buildEvidenceChain([
      ...run.evidence.slice(0, 4),
      tampered,
    ]);
    assert.equal(built.ok, false);
    assert.ok(!built.ok && built.errors.some((e) => e.includes("tampered")));
  });

  it("records unauthorized attempts as valid chain evidence", () => {
    const unauthorized = makeEvidenceRecord({
      evidence_id: branded("ev-unauthorized"),
      stage: "action",
      task_id: fixture.task.task_id,
      run_id: run.run_id,
      attempt_id: run.attempt_id,
      subject_id: "act-denied",
      parent_evidence_id: run.evidence[2].evidence_id, // attempt stage
      kind_detail: UNAUTHORIZED_ATTEMPT_KIND,
      data: { capability: "review.reply.publish", reason: "receipt_required" },
      occurred_at: T3,
    });
    const built = buildEvidenceChain([...run.evidence, unauthorized]);
    assert.equal(built.ok, true, JSON.stringify(built));
    assert.deepEqual(findOrphans([...run.evidence, unauthorized]), []);
  });
});
