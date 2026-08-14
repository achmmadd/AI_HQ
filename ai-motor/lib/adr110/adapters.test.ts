/**
 * ADR-110 proof — fake adapter contract tests: both adapters implement the
 * adapter contract (id+version, capabilities, requirements, health/invoke/
 * cancel, normalized result/error model, causal id echo) and own no state.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ADAPTER_CONTRACT_MEMBERS,
} from "./adapters/contract.ts";
import type { AdapterInvokeRequest, CapabilityAdapter } from "./adapters/contract.ts";
import {
  createFakeAlphaAdapter,
  FAKE_ALPHA_SIMULATED_COST_CENTS,
  FAKE_ALPHA_SIMULATED_LATENCY_MS,
} from "./adapters/fake-alpha.ts";
import {
  createFakeBetaAdapter,
  FAKE_BETA_SIMULATED_COST_CENTS,
  FAKE_BETA_SIMULATED_LATENCY_MS,
} from "./adapters/fake-beta.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
  T1,
} from "./scenario.ts";
import { branded } from "./types.ts";

const fixture = buildProofFixture();
const alpha = createFakeAlphaAdapter();
const beta = createFakeBetaAdapter();

async function invokeRequest(adapter: CapabilityAdapter): Promise<AdapterInvokeRequest> {
  const run = await runTaskThroughAdapter(adapter, fixture, createRunIds("contract"));
  return {
    task_id: fixture.task.task_id,
    run_id: run.run_id,
    attempt_id: run.attempt_id,
    manifest: run.manifest,
    agent: run.agent,
    runtime: run.runtime,
    model: run.model,
    input: "Draft a friendly reply to review #42",
  };
}

for (const [name, adapter] of [
  ["fake-alpha", alpha],
  ["fake-beta", beta],
] as const) {
  describe(`adapter contract: ${name}`, () => {
    it("exposes exactly the contract members (statelessness by shape)", () => {
      assert.deepEqual(
        Object.keys(adapter).sort(),
        [...ADAPTER_CONTRACT_MEMBERS].sort(),
      );
      assert.ok(Object.isFrozen(adapter));
    });

    it("declares id, version, capabilities and requirements", () => {
      assert.equal(adapter.adapter_id, name);
      assert.match(adapter.adapter_version, /^\d+\.\d+\.\d+$/);
      assert.ok(adapter.capabilities.includes("draft.generate"));
      assert.equal(adapter.requirements.network, "none");
      assert.ok(adapter.requirements.data_classes.includes("internal"));
    });

    it("health() reports ok at the injected time", async () => {
      const health = await adapter.health(T1);
      assert.equal(health.status, "ok");
      assert.equal(health.adapter_id, name);
      assert.equal(health.checked_at, T1);
    });

    it("invoke() echoes the causal ids and is deterministic (no counters/state)", async () => {
      const request = await invokeRequest(adapter);
      const first = await adapter.invoke(request);
      const second = await adapter.invoke(request);
      assert.deepEqual(second, first);
      assert.equal(first.ok, true);
      if (!first.ok) return;
      assert.equal(first.meta.task_id, request.task_id);
      assert.equal(first.meta.run_id, request.run_id);
      assert.equal(first.meta.attempt_id, request.attempt_id);
      assert.equal(first.meta.adapter_id, name);
    });

    it("returns the normalized error model on simulated failure", async () => {
      const request = { ...(await invokeRequest(adapter)), input: "FAIL please" };
      const result = await adapter.invoke(request);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "SIMULATED_FAILURE");
      assert.equal(result.error.retryable, true);
      assert.equal(result.error.task_id, request.task_id);
      assert.equal(result.error.run_id, request.run_id);
      assert.equal(result.error.attempt_id, request.attempt_id);
    });

    it("cancel() acknowledges the attempt", async () => {
      const result = await adapter.cancel(branded("att-x"), T1);
      assert.equal(result.cancelled, true);
      assert.equal(result.attempt_id, branded("att-x"));
    });
  });
}

describe("the two fakes simulate different runtimes/providers", () => {
  it("differ in latency/cost metadata and output format only", async () => {
    assert.notEqual(
      FAKE_ALPHA_SIMULATED_LATENCY_MS,
      FAKE_BETA_SIMULATED_LATENCY_MS,
    );
    assert.notEqual(
      FAKE_ALPHA_SIMULATED_COST_CENTS,
      FAKE_BETA_SIMULATED_COST_CENTS,
    );
    const a = await alpha.invoke(await invokeRequest(alpha));
    const b = await beta.invoke(await invokeRequest(beta));
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.notEqual(a.output, b.output);
  });
});
