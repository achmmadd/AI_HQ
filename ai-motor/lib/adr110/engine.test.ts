/**
 * ADR-110 proof — engine/Kernel separation tests (acceptance criterion 3):
 * idempotent event application and no double Run truth.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyEngineEvent,
  applyEngineEventToEngine,
  initialEngineState,
  initialKernelProjection,
} from "./engine.ts";
import type { EngineEvent, KernelProjection } from "./engine.ts";
import { buildProofFixture, T1, T2, T3, T4 } from "./scenario.ts";
import { ADR110_SCHEMA_VERSION, branded } from "./types.ts";
import type { AttemptId } from "./types.ts";

const fixture = buildProofFixture();

function event(
  id: string,
  seq: number,
  type: EngineEvent["type"],
  at = T1,
): EngineEvent {
  return {
    schema_version: ADR110_SCHEMA_VERSION,
    event_id: branded(id),
    seq,
    workspace_id: fixture.task.workspace_id,
    task_id: fixture.task.task_id,
    run_id: branded("run-e1"),
    attempt_id: type.startsWith("attempt") ? branded<AttemptId>("att-e1") : undefined,
    type,
    occurred_at: at,
  };
}

describe("applyEngineEvent (Kernel projection)", () => {
  it("is idempotent on event-id: same event twice yields the identical state", () => {
    const e = event("evt-1", 1, "run.started");
    const p0 = initialKernelProjection();
    const p1 = applyEngineEvent(p0, e);
    const p2 = applyEngineEvent(p1, e);
    assert.equal(p2, p1, "re-application must return the same reference");
    assert.deepEqual(p2, p1);
    assert.equal(p2.tasks[fixture.task.task_id as string].applied_events, 1);
  });

  it("projects task lifecycle from distinct events", () => {
    let p = initialKernelProjection();
    p = applyEngineEvent(p, event("evt-1", 1, "run.started", T1));
    p = applyEngineEvent(p, event("evt-2", 2, "attempt.started", T2));
    p = applyEngineEvent(p, event("evt-3", 3, "attempt.succeeded", T3));
    p = applyEngineEvent(p, event("evt-4", 4, "run.completed", T4));
    const task = p.tasks[fixture.task.task_id as string];
    assert.equal(task.status, "completed");
    assert.equal(task.applied_events, 4);
  });

  it("terminal status does not regress on late events", () => {
    let p = initialKernelProjection();
    p = applyEngineEvent(p, event("evt-1", 1, "run.started", T1));
    p = applyEngineEvent(p, event("evt-2", 2, "run.completed", T2));
    p = applyEngineEvent(p, event("evt-3", 3, "attempt.started", T3));
    assert.equal(p.tasks[fixture.task.task_id as string].status, "completed");
  });

  it("has no Run state and no Run-mutation API (no double Run truth)", () => {
    let p = initialKernelProjection();
    p = applyEngineEvent(p, event("evt-1", 1, "run.started", T1));
    p = applyEngineEvent(p, event("evt-2", 2, "run.completed", T2));
    assert.equal("runs" in p, false);
    assert.equal("attempts" in p, false);
    assert.deepEqual(Object.keys(p).sort(), ["applied", "tasks"]);
    // The projection only holds task status; the run record lives solely
    // in the engine state below.
    assert.equal(
      JSON.stringify(p).includes('"running"'),
      false,
      "kernel projection must not embed run records",
    );
  });
});

describe("engine state owns Run/Attempt (separate from the Kernel)", () => {
  it("engine applies the same events idempotently and owns the run record", () => {
    const e1 = event("evt-1", 1, "run.started", T1);
    const e2 = event("evt-2", 2, "attempt.started", T2);
    const e3 = event("evt-3", 3, "run.completed", T4);
    let s = initialEngineState();
    s = applyEngineEventToEngine(s, e1);
    s = applyEngineEventToEngine(s, e2);
    const before = s;
    s = applyEngineEventToEngine(s, e2);
    assert.equal(s, before, "engine re-application must be a no-op");
    s = applyEngineEventToEngine(s, e3);
    assert.equal(s.runs["run-e1"].status, "completed");
    assert.equal(s.attempts["att-e1"].status, "running");
    // The Kernel projection of the same events contains no run truth.
    let p = initialKernelProjection();
    for (const e of [e1, e2, e3]) p = applyEngineEvent(p, e);
    assert.equal("runs" in p, false);
  });
});

// Compile-time proof: KernelProjection structurally cannot hold run state.
type AssertNoRunTruth =
  KernelProjection extends { runs: unknown } ? never : true;
const noRunTruth: AssertNoRunTruth = true;
void noRunTruth;
