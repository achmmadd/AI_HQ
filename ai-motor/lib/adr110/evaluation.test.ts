/**
 * ADR-110 proof — Evaluation tests (acceptance criterion 5):
 * the five active criteria computed from the same causal evidence chain,
 * asserted against exact expected values from a known fixture.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeEvaluation } from "./evaluation.ts";
import type { OutcomeData } from "./evaluation.ts";
import {
  buildEvidenceChain,
  makeEvidenceRecord,
  UNAUTHORIZED_ATTEMPT_KIND,
} from "./evidence.ts";
import type { EvidenceChain } from "./evidence.ts";
import type {
  AttemptId,
  EvidenceRecord,
  RunId,
  TaskId,
} from "./types.ts";
import { branded, isoTimestamp } from "./types.ts";

const AT = isoTimestamp("2026-08-14T10:00:00.000Z");

interface TaskSpec {
  readonly label: string;
  readonly status: "success" | "failure";
  readonly rating: "approved" | "corrected" | "rejected";
  readonly corrections: number;
  readonly cost_cents: number;
}

function chainFor(specs: readonly TaskSpec[]): EvidenceChain {
  const records: EvidenceRecord[] = [];
  for (const spec of specs) {
    const taskId = branded<TaskId>(`task-${spec.label}`);
    const runId = branded<RunId>(`run-${spec.label}`);
    const attemptId = branded<AttemptId>(`att-${spec.label}`);
    const evTask = makeEvidenceRecord({
      evidence_id: branded(`ev-${spec.label}-task`),
      stage: "task",
      task_id: taskId,
      kind_detail: "task.assigned",
      data: {},
      occurred_at: AT,
    });
    const evRun = makeEvidenceRecord({
      evidence_id: branded(`ev-${spec.label}-run`),
      stage: "run",
      task_id: taskId,
      run_id: runId,
      parent_evidence_id: evTask.evidence_id,
      kind_detail: "run.started",
      data: {},
      occurred_at: AT,
    });
    const evAttempt = makeEvidenceRecord({
      evidence_id: branded(`ev-${spec.label}-attempt`),
      stage: "attempt",
      task_id: taskId,
      run_id: runId,
      attempt_id: attemptId,
      parent_evidence_id: evRun.evidence_id,
      kind_detail: "context.manifest.bound",
      data: {},
      occurred_at: AT,
    });
    const evArtifact = makeEvidenceRecord({
      evidence_id: branded(`ev-${spec.label}-artifact`),
      stage: "artifact",
      task_id: taskId,
      run_id: runId,
      attempt_id: attemptId,
      parent_evidence_id: evAttempt.evidence_id,
      kind_detail: "adapter.result",
      data: { output: "draft", cost_cents: spec.cost_cents },
      occurred_at: AT,
    });
    const outcome: OutcomeData = {
      status: spec.status,
      human_review: {
        rating: spec.rating,
        corrections: spec.corrections,
        reviewed_by: "identity-pietje",
      },
    };
    const evOutcome = makeEvidenceRecord({
      evidence_id: branded(`ev-${spec.label}-outcome`),
      stage: "outcome",
      task_id: taskId,
      run_id: runId,
      attempt_id: attemptId,
      parent_evidence_id: evArtifact.evidence_id,
      kind_detail: "human.review",
      data: outcome,
      occurred_at: AT,
    });
    records.push(evTask, evRun, evAttempt, evArtifact, evOutcome);
  }
  const built = buildEvidenceChain(records);
  assert.equal(built.ok, true, JSON.stringify(built));
  if (!built.ok) throw new Error("unreachable");
  return built.chain;
}

const FIXTURE: readonly TaskSpec[] = [
  { label: "1", status: "success", rating: "approved", corrections: 0, cost_cents: 5 },
  { label: "2", status: "success", rating: "corrected", corrections: 2, cost_cents: 5 },
  { label: "3", status: "failure", rating: "rejected", corrections: 1, cost_cents: 4 },
  { label: "4", status: "failure", rating: "corrected", corrections: 0, cost_cents: 6 },
];

describe("computeEvaluation — five active criteria from one evidence chain", () => {
  it("computes exact expected metric values", () => {
    const metrics = computeEvaluation(chainFor(FIXTURE));
    // (1) 2 successes / 4 completed
    assert.equal(metrics.task_success_rate, 0.5);
    // (2) 3 corrections / 4 tasks * 10
    assert.equal(metrics.human_corrections_per_10_tasks, 7.5);
    // (3) no unauthorized attempts in this fixture
    assert.equal(metrics.unauthorized_actions, 0);
    // (7) 20 cents total / 2 successful tasks
    assert.equal(metrics.cost_per_successful_task_cents, 10);
    // (16) (1 + 0.5 + 0 + 0.5) / 4 reviews
    assert.equal(metrics.operator_trust_score, 0.5);
  });
  it("counts unauthorized attempts recorded as evidence", () => {
    const base = chainFor(FIXTURE);
    const attemptRecord = base.records.find((r) => r.stage === "attempt");
    assert.ok(attemptRecord !== undefined);
    const unauthorized = [1, 2].map((n) =>
      makeEvidenceRecord({
        evidence_id: branded(`ev-unauthorized-${n}`),
        stage: "action",
        task_id: attemptRecord.task_id,
        run_id: attemptRecord.run_id,
        attempt_id: attemptRecord.attempt_id,
        parent_evidence_id: attemptRecord.evidence_id,
        kind_detail: UNAUTHORIZED_ATTEMPT_KIND,
        data: { capability: "review.reply.publish", reason: "receipt_required" },
        occurred_at: AT,
      }),
    );
    const extended = buildEvidenceChain([...base.records, ...unauthorized]);
    assert.equal(extended.ok, true);
    if (!extended.ok) return;
    const metrics = computeEvaluation(extended.chain);
    assert.equal(metrics.unauthorized_actions, 2);
    // the other criteria are unaffected
    assert.equal(metrics.task_success_rate, 0.5);
    assert.equal(metrics.cost_per_successful_task_cents, 10);
  });

  it("returns zeros for an empty chain", () => {
    const built = buildEvidenceChain([]);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const metrics = computeEvaluation(built.chain);
    assert.deepEqual(metrics, {
      task_success_rate: 0,
      human_corrections_per_10_tasks: 0,
      unauthorized_actions: 0,
      cost_per_successful_task_cents: 0,
      operator_trust_score: 0,
    });
  });
});
