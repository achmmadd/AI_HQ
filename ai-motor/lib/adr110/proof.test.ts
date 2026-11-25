/**
 * ADR-110 proof — headline scenario (acceptance criteria 1 and 6).
 *
 * Criterion 1: the same Employee and the same Task run through two fake
 * adapters without semantic ID or policy change.
 * Criterion 6: the proof module exposes no store / no second truth — proven
 * by design (PROOF.md) and by the module-surface assertions below.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import * as api from "./index.ts";
import { manifestSemanticsEqual, validateManifest } from "./context.ts";
import { buildEvidenceChain, findOrphans } from "./evidence.ts";
import { applyEngineEvent, initialKernelProjection } from "./engine.ts";
import { createFakeAlphaAdapter } from "./adapters/fake-alpha.ts";
import { createFakeBetaAdapter } from "./adapters/fake-beta.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
} from "./scenario.ts";

const fixture = buildProofFixture();
const runA = await runTaskThroughAdapter(
  createFakeAlphaAdapter(),
  fixture,
  createRunIds("a"),
);
const runB = await runTaskThroughAdapter(
  createFakeBetaAdapter(),
  fixture,
  createRunIds("b"),
);

describe("proof scenario: one Employee, one Task, two fake adapters", () => {
  it("keeps employee_id and task_id identical across adapters", () => {
    assert.equal(fixture.employee.role, "ReviewResponder");
    assert.equal(runA.manifest.task_id, runB.manifest.task_id);
    assert.equal(
      fixture.task.employee_id,
      fixture.employee.employee_id,
    );
    assert.equal(runA.agent.delegated_by, runB.agent.delegated_by);
    assert.equal(runA.agent.delegated_by, fixture.employee.employee_id);
  });

  it("keeps the policy digest identical across adapters", () => {
    assert.equal(runA.manifest.policy.digest, runB.manifest.policy.digest);
    assert.equal(runA.manifest.policy.version, runB.manifest.policy.version);
  });

  it("keeps manifest semantics identical across adapters", () => {
    assert.equal(
      manifestSemanticsEqual(runA.manifest, runB.manifest),
      true,
    );
    assert.equal(runA.manifest.total_digest, runB.manifest.total_digest);
    assert.equal(validateManifest(runA.manifest, fixture.now).ok, true);
    assert.equal(validateManifest(runB.manifest, fixture.now).ok, true);
  });

  it("both adapters return causal ids bound to their own run/attempt", () => {
    assert.equal(runA.result.ok, true);
    assert.equal(runB.result.ok, true);
    if (!runA.result.ok || !runB.result.ok) return;
    assert.equal(runA.result.meta.task_id, fixture.task.task_id);
    assert.equal(runB.result.meta.task_id, fixture.task.task_id);
    assert.equal(runA.result.meta.run_id, runA.run_id);
    assert.equal(runB.result.meta.run_id, runB.run_id);
    assert.notEqual(runA.result.meta.adapter_id, runB.result.meta.adapter_id);
  });

  it("both runs produce valid, orphan-free evidence chains", () => {
    for (const run of [runA, runB]) {
      const built = buildEvidenceChain(run.evidence);
      assert.equal(built.ok, true, JSON.stringify(built));
      assert.deepEqual(findOrphans(run.evidence), []);
    }
  });

  it("engine events from both runs project idempotently into the Kernel", () => {
    let projection = initialKernelProjection();
    for (const event of [...runA.engine_events, ...runB.engine_events]) {
      projection = applyEngineEvent(projection, event);
    }
    const before = projection;
    for (const event of [...runA.engine_events, ...runB.engine_events]) {
      projection = applyEngineEvent(projection, event);
    }
    assert.equal(
      projection,
      before,
      "replaying all events must be a no-op",
    );
    const task = projection.tasks[fixture.task.task_id as string];
    assert.equal(task.status, "completed");
    assert.equal(task.applied_events, 8);
  });
});

describe("criterion 6: no second task/context/policy/memory truth", () => {
  it("the public API exposes no store, database, persistence or credentials", () => {
    const names = Object.keys(api);
    const forbidden = /store|database|sqlite|persist|credential|secret|cache|repository/i;
    assert.deepEqual(
      names.filter((name) => forbidden.test(name)),
      [],
    );
  });

  it("exports only functions, frozen values and primitives (no mutable state)", () => {
    for (const [name, value] of Object.entries(api)) {
      if (typeof value === "function") continue;
      if (value !== null && typeof value === "object") {
        assert.ok(
          Object.isFrozen(value),
          `export ${name} must be frozen`,
        );
      }
    }
  });

  it("adapters expose no state beyond the contract", () => {
    for (const adapter of [createFakeAlphaAdapter(), createFakeBetaAdapter()]) {
      assert.deepEqual(
        Object.keys(adapter).sort(),
        [...api.ADAPTER_CONTRACT_MEMBERS].sort(),
      );
    }
  });
});
