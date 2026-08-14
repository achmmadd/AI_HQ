/**
 * agentscope.test.ts — lane-C proof for the AgentScope CapabilityAdapter.
 *
 * CI runs everything here against a deterministic FAKE sidecar (a Node
 * http server inside this file); no real AgentScope install, model or
 * network is involved. The real Python sidecar
 * (pilot/adapters/agentscope/sidecar.py) is covered by static source
 * guards below. REAL_CONTEXT_USED=no, EXTERNAL_EFFECTS=no.
 *
 * Proven here:
 * - contract shape: exactly the contract members, frozen, no credentials;
 * - config fail-closed (protocol bounds 5 s / 120 s / 1 MiB, http-only);
 * - health ok/degraded/down, unreachable and slow sidecar → down;
 * - invoke success with exact causal-id echo and least-context request
 *   (only task_id/run_id/attempt_id/input leave the adapter);
 * - echo mismatch on task/run/attempt → causal_mismatch (fail closed);
 * - malformed/oversized responses and oversized requests → malformed_response;
 * - unavailable (refused/5xx), timeout, cancel and late-response handling;
 * - no adapter-side retry loop (retry belongs to the Motor engine);
 * - same Employee/Task/context/policy semantics as the pure fakes;
 * - adapter failures terminate in a controlled terminal Motor state with
 *   causal failure evidence (valid chain, no orphans);
 * - the adapter only ever speaks the three protocol endpoints.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import {
  ADAPTER_CONTRACT_MEMBERS,
  type AdapterInvokeRequest,
} from "../lib/adr110/adapters/contract.ts";
import { createFakeAlphaAdapter } from "../lib/adr110/adapters/fake-alpha.ts";
import {
  AGENTSCOPE_ADAPTER_ID,
  AGENTSCOPE_ADAPTER_VERSION,
  AGENTSCOPE_ERROR_CODES,
  AGENTSCOPE_PROTOCOL_LIMITS,
  createAgentScopeAdapter,
  type AgentScopeSidecarConfig,
} from "../lib/adr110/adapters/agentscope/sidecar-client.ts";
import {
  applyEngineEvent,
  initialKernelProjection,
  type EngineEvent,
} from "../lib/adr110/engine.ts";
import {
  buildEvidenceChain,
  findOrphans,
  makeEvidenceRecord,
} from "../lib/adr110/evidence.ts";
import {
  buildProofFixture,
  createRunIds,
  PROOF_WORKSPACE_ID,
  runTaskThroughAdapter,
  T1,
  T2,
  T3,
} from "../lib/adr110/scenario.ts";
import { ADR110_SCHEMA_VERSION, branded } from "../lib/adr110/types.ts";

const fixture = buildProofFixture();

// ---------------------------------------------------------------------------
// Deterministic fake sidecar
// ---------------------------------------------------------------------------

interface FakeBehavior {
  healthStatus?: "ok" | "degraded" | "down";
  healthDelayMs?: number;
  healthRawBody?: string;
  invokeStatus?: number;
  invokeOutput?: string;
  invokeEcho?: { task_id?: string; run_id?: string; attempt_id?: string };
  invokeOmitEcho?: boolean;
  invokeExtraFields?: Record<string, unknown>;
  invokeRawBody?: string;
  invokeOversized?: boolean;
  invokeDelayMs?: number;
  invokeHold?: boolean;
  cancelCancelled?: boolean;
  cancelDelayMs?: number;
}

interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly body: string;
}

interface FakeSidecar {
  readonly url: string;
  readonly requests: RecordedRequest[];
  readonly behavior: FakeBehavior;
  readonly releaseHeld: () => void;
  readonly close: () => Promise<void>;
}

async function startFakeSidecar(initial: FakeBehavior): Promise<FakeSidecar> {
  const behavior: FakeBehavior = { ...initial };
  const requests: RecordedRequest[] = [];
  const held: Array<() => void> = [];

  function respondJson(res: ServerResponse, status: number, payload: unknown) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  }

  // A response whose client already aborted (timeout/cancel) must never
  // crash the fake: writing to a destroyed socket throws synchronously.
  function safe(respond: () => void): () => void {
    return () => {
      try {
        respond();
      } catch {
        // Late bytes are discarded by the transport.
      }
    };
  }

  function route(req: IncomingMessage, res: ServerResponse, body: string) {
    if (req.method === "GET" && req.url === "/health") {
      const respond = safe(() => {
        if (behavior.healthRawBody !== undefined) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(behavior.healthRawBody);
          return;
        }
        respondJson(res, 200, { status: behavior.healthStatus ?? "ok" });
      });
      if (behavior.healthDelayMs) setTimeout(respond, behavior.healthDelayMs);
      else respond();
      return;
    }
    if (req.method === "POST" && req.url === "/invoke") {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      const respond = safe(() => {
        const status = behavior.invokeStatus ?? 200;
        if (status !== 200) {
          respondJson(res, status, { error: "fake sidecar failure" });
          return;
        }
        if (behavior.invokeRawBody !== undefined) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(behavior.invokeRawBody);
          return;
        }
        const output = behavior.invokeOversized
          ? "x".repeat(AGENTSCOPE_PROTOCOL_LIMITS.MAX_BODY_BYTES + 1)
          : (behavior.invokeOutput ??
            `fake-agentscope draft: ${String(parsed.input ?? "")}`);
        const payload: Record<string, unknown> = {
          output,
          ...(behavior.invokeExtraFields ?? {}),
        };
        if (!behavior.invokeOmitEcho) {
          payload.task_id = behavior.invokeEcho?.task_id ?? parsed.task_id;
          payload.run_id = behavior.invokeEcho?.run_id ?? parsed.run_id;
          payload.attempt_id =
            behavior.invokeEcho?.attempt_id ?? parsed.attempt_id;
        }
        respondJson(res, 200, payload);
      });
      if (behavior.invokeHold) {
        held.push(respond);
        return;
      }
      if (behavior.invokeDelayMs) setTimeout(respond, behavior.invokeDelayMs);
      else respond();
      return;
    }
    if (req.method === "POST" && req.url === "/cancel") {
      const respond = safe(() =>
        respondJson(res, 200, {
          cancelled: behavior.cancelCancelled ?? true,
        }),
      );
      if (behavior.cancelDelayMs) setTimeout(respond, behavior.cancelDelayMs);
      else respond();
      return;
    }
    // Protocol discipline: everything else — tools, MCP, store — is refused.
    respondJson(res, 404, { error: "not_found" });
  }

  const server: Server = createServer((req, res) => {
    res.on("error", () => undefined);
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      requests.push({
        method: req.method ?? "",
        path: req.url ?? "",
        body,
      });
      route(req, res, body);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    behavior,
    releaseHeld: () => {
      for (const release of held.splice(0)) release();
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function withFakeSidecar(
  initial: FakeBehavior,
  fn: (sidecar: FakeSidecar) => Promise<void>,
): Promise<void> {
  const sidecar = await startFakeSidecar(initial);
  try {
    await fn(sidecar);
  } finally {
    await sidecar.close();
  }
}

function testConfig(
  url: string,
  overrides: Partial<AgentScopeSidecarConfig> = {},
): AgentScopeSidecarConfig {
  return {
    sidecarUrl: url,
    invokeTimeoutMs: 1_000,
    healthTimeoutMs: 300,
    cancelTimeoutMs: 300,
    ...overrides,
  };
}

/** Builds a real AdapterInvokeRequest via the shared fixture machinery
 *  (pure fake-alpha, no I/O) so every test reuses the same Employee/Task/
 *  context/policy semantics as the existing contract proofs. */
async function makeInvokeRequest(label: string): Promise<AdapterInvokeRequest> {
  const run = await runTaskThroughAdapter(
    createFakeAlphaAdapter(),
    fixture,
    createRunIds(label),
  );
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

async function waitFor(
  condition: () => boolean,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("waitFor: condition not met");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// ---------------------------------------------------------------------------
// Contract shape and configuration
// ---------------------------------------------------------------------------

describe("agentscope adapter: contract shape", () => {
  it("exposes exactly the contract members and is frozen (no state, no credentials)", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      assert.deepEqual(
        Object.keys(adapter).sort(),
        [...ADAPTER_CONTRACT_MEMBERS].sort(),
      );
      assert.ok(Object.isFrozen(adapter));
      const serialized = JSON.stringify(adapter);
      assert.ok(!/(secret|token|api[-_]?key|password)/i.test(serialized));
      assert.ok(!serialized.includes(String(new URL(sidecar.url).port)));
    });
  });

  it("declares stable id, version, minimal capability and requirements", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      assert.equal(adapter.adapter_id, AGENTSCOPE_ADAPTER_ID);
      assert.equal(adapter.adapter_id, "agentscope");
      assert.match(adapter.adapter_version, /^\d+\.\d+\.\d+$/);
      assert.deepEqual(adapter.capabilities, ["draft.generate"]);
      assert.equal(adapter.requirements.network, "egress");
      assert.ok(adapter.requirements.data_classes.includes("internal"));
    });
  });

  it("uses exactly the phase-0 error taxonomy", () => {
    assert.deepEqual(
      [...AGENTSCOPE_ERROR_CODES].sort(),
      [
        "cancelled",
        "causal_mismatch",
        "malformed_response",
        "timeout",
        "unavailable",
      ],
    );
  });

  it("fails closed on out-of-bounds configuration", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig(sidecar.url, { invokeTimeoutMs: 120_001 }),
          ),
        RangeError,
      );
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig(sidecar.url, { healthTimeoutMs: 5_001 }),
          ),
        RangeError,
      );
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig(sidecar.url, { cancelTimeoutMs: 5_001 }),
          ),
        RangeError,
      );
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig(sidecar.url, { maxBodyBytes: 1_048_577 }),
          ),
        RangeError,
      );
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig(sidecar.url, { invokeTimeoutMs: 0 }),
          ),
        RangeError,
      );
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig("https://127.0.0.1:1", { invokeTimeoutMs: 1_000 }),
          ),
        RangeError,
      );
      assert.throws(
        () =>
          createAgentScopeAdapter(
            testConfig("http://user:pw@127.0.0.1:1", { invokeTimeoutMs: 1_000 }),
          ),
        RangeError,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// health()
// ---------------------------------------------------------------------------

describe("agentscope adapter: health", () => {
  it("reports ok at the injected time", async () => {
    await withFakeSidecar({ healthStatus: "ok" }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const health = await adapter.health(T1);
      assert.equal(health.status, "ok");
      assert.equal(health.adapter_id, AGENTSCOPE_ADAPTER_ID);
      assert.equal(health.adapter_version, AGENTSCOPE_ADAPTER_VERSION);
      assert.equal(health.checked_at, T1);
    });
  });

  it("maps degraded and down sidecar statuses", async () => {
    await withFakeSidecar({ healthStatus: "degraded" }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      assert.equal((await adapter.health(T1)).status, "degraded");
    });
    await withFakeSidecar({ healthStatus: "down" }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      assert.equal((await adapter.health(T1)).status, "down");
    });
  });

  it("reports down when the sidecar is unreachable", async () => {
    const sidecar = await startFakeSidecar({});
    const url = sidecar.url;
    await sidecar.close();
    const adapter = createAgentScopeAdapter(testConfig(url));
    assert.equal((await adapter.health(T1)).status, "down");
  });

  it("reports down on a malformed health body", async () => {
    await withFakeSidecar({ healthRawBody: "not json{" }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      assert.equal((await adapter.health(T1)).status, "down");
    });
  });

  it("reports down when health exceeds its 5 s-bounded timeout", async () => {
    await withFakeSidecar(
      { healthDelayMs: 500 },
      async (sidecar) => {
        const adapter = createAgentScopeAdapter(
          testConfig(sidecar.url, { healthTimeoutMs: 150 }),
        );
        assert.equal((await adapter.health(T1)).status, "down");
      },
    );
  });
});

// ---------------------------------------------------------------------------
// invoke() — happy path and causal echo
// ---------------------------------------------------------------------------

describe("agentscope adapter: invoke success and causal echo", () => {
  it("succeeds and echoes the exact causal ids", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("c-success");
      const result = await adapter.invoke(request);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.ok(result.output.includes("fake-agentscope draft"));
      assert.equal(result.meta.task_id, request.task_id);
      assert.equal(result.meta.run_id, request.run_id);
      assert.equal(result.meta.attempt_id, request.attempt_id);
      assert.equal(result.meta.adapter_id, AGENTSCOPE_ADAPTER_ID);
      assert.equal(result.meta.adapter_version, AGENTSCOPE_ADAPTER_VERSION);
      assert.ok(result.meta.simulated_latency_ms >= 0);
      assert.equal(result.meta.simulated_cost_cents, 0);
    });
  });

  it("sends a least-context request: exactly task_id, run_id, attempt_id, input", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("c-least-context");
      const result = await adapter.invoke(request);
      assert.equal(result.ok, true);
      const invokeCalls = sidecar.requests.filter((r) => r.path === "/invoke");
      assert.equal(invokeCalls.length, 1);
      const sent = JSON.parse(invokeCalls[0].body) as Record<string, unknown>;
      assert.deepEqual(Object.keys(sent).sort(), [
        "attempt_id",
        "input",
        "run_id",
        "task_id",
      ]);
      assert.equal(sent.task_id, request.task_id as string);
      assert.equal(sent.run_id, request.run_id as string);
      assert.equal(sent.attempt_id, request.attempt_id as string);
      assert.equal(sent.input, request.input);
    });
  });

  it("tolerates unknown extra response fields (forward-compatible)", async () => {
    await withFakeSidecar(
      { invokeExtraFields: { trace_id: "future-field" } },
      async (sidecar) => {
        const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
        const result = await adapter.invoke(await makeInvokeRequest("c-extra"));
        assert.equal(result.ok, true);
      },
    );
  });

  it("fails closed as causal_mismatch when any echoed id differs", async () => {
    for (const [label, echo] of [
      ["task", { task_id: "task-other" }],
      ["run", { run_id: "run-other" }],
      ["attempt", { attempt_id: "att-other" }],
    ] as const) {
      await withFakeSidecar({ invokeEcho: echo }, async (sidecar) => {
        const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
        const request = await makeInvokeRequest(`c-mismatch-${label}`);
        const result = await adapter.invoke(request);
        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.error.code, "causal_mismatch");
        assert.equal(result.error.retryable, false);
        assert.equal(result.error.task_id, request.task_id);
        assert.equal(result.error.run_id, request.run_id);
        assert.equal(result.error.attempt_id, request.attempt_id);
      });
    }
  });

  it("fails closed as malformed_response when the echo fields are missing", async () => {
    await withFakeSidecar({ invokeOmitEcho: true }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.invoke(await makeInvokeRequest("c-noecho"));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "malformed_response");
      assert.equal(result.error.retryable, false);
    });
  });
});

// ---------------------------------------------------------------------------
// invoke() — malformed, oversized
// ---------------------------------------------------------------------------

describe("agentscope adapter: malformed and oversized", () => {
  it("rejects a non-JSON response as malformed_response", async () => {
    await withFakeSidecar({ invokeRawBody: "<html>broken" }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.invoke(await makeInvokeRequest("c-notjson"));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "malformed_response");
      assert.equal(result.error.retryable, false);
    });
  });

  it("rejects a missing or empty output as malformed_response", async () => {
    await withFakeSidecar({ invokeOutput: "" }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.invoke(await makeInvokeRequest("c-empty"));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "malformed_response");
    });
  });

  it("rejects a response over the 1 MiB protocol cap", async () => {
    await withFakeSidecar({ invokeOversized: true }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.invoke(await makeInvokeRequest("c-big-resp"));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "malformed_response");
      assert.equal(result.error.retryable, false);
    });
  });

  it("refuses to send a request over the 1 MiB cap (no HTTP call at all)", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("c-big-req");
      const oversized = { ...request, input: "x".repeat(1_048_576) };
      const result = await adapter.invoke(oversized);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "malformed_response");
      assert.equal(result.error.retryable, false);
      assert.equal(
        sidecar.requests.filter((r) => r.path === "/invoke").length,
        0,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// invoke() — unavailable, timeout, no retry
// ---------------------------------------------------------------------------

describe("agentscope adapter: unavailable and timeout", () => {
  it("maps a refused connection to retryable unavailable", async () => {
    const sidecar = await startFakeSidecar({});
    const url = sidecar.url;
    await sidecar.close();
    const adapter = createAgentScopeAdapter(testConfig(url));
    const result = await adapter.invoke(await makeInvokeRequest("c-refused"));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "unavailable");
    assert.equal(result.error.retryable, true);
  });

  it("maps HTTP 500 to retryable unavailable and never retries itself", async () => {
    await withFakeSidecar({ invokeStatus: 500 }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.invoke(await makeInvokeRequest("c-500"));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "unavailable");
      assert.equal(result.error.retryable, true);
      assert.equal(
        sidecar.requests.filter((r) => r.path === "/invoke").length,
        1,
        "no adapter-side retry loop; retry belongs to the Motor engine",
      );
    });
  });

  it("maps HTTP 400 to non-retryable unavailable", async () => {
    await withFakeSidecar({ invokeStatus: 400 }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.invoke(await makeInvokeRequest("c-400"));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "unavailable");
      assert.equal(result.error.retryable, false);
    });
  });

  it("maps a slow invoke to retryable timeout and discards the late response", async () => {
    await withFakeSidecar({ invokeHold: true }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(
        testConfig(sidecar.url, { invokeTimeoutMs: 150 }),
      );
      const request = await makeInvokeRequest("c-slow");
      const pending = adapter.invoke(request);
      await waitFor(() =>
        sidecar.requests.some((r) => r.path === "/invoke"),
      );
      const result = await pending;
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "timeout");
      assert.equal(result.error.retryable, true);
      // The late response arrives after the timeout and must not corrupt
      // the adapter: a fresh attempt succeeds immediately after release.
      sidecar.behavior.invokeHold = false;
      sidecar.releaseHeld();
      const second = await adapter.invoke(await makeInvokeRequest("c-after"));
      assert.equal(second.ok, true);
    });
  });
});

// ---------------------------------------------------------------------------
// cancel() — async seam (phase-0 decision 1)
// ---------------------------------------------------------------------------

describe("agentscope adapter: cancel", () => {
  it("aborts an in-flight invoke and acknowledges via the sidecar", async () => {
    await withFakeSidecar({ invokeHold: true }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("c-cancel");
      const pending = adapter.invoke(request);
      await waitFor(() =>
        sidecar.requests.some((r) => r.path === "/invoke"),
      );
      const cancelResult = await adapter.cancel(request.attempt_id, T2);
      assert.equal(cancelResult.cancelled, true);
      assert.equal(cancelResult.attempt_id, request.attempt_id);
      const result = await pending;
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "cancelled");
      assert.equal(result.error.retryable, false);
      assert.equal(result.error.attempt_id, request.attempt_id);
      // The held sidecar response is released after the abort: discarded.
      sidecar.behavior.invokeHold = false;
      sidecar.releaseHeld();
      assert.ok(
        sidecar.requests.some((r) => r.path === "/cancel"),
        "cancel is forwarded to the sidecar",
      );
      const cancelCall = sidecar.requests.find((r) => r.path === "/cancel");
      assert.deepEqual(JSON.parse(cancelCall?.body ?? "{}"), {
        attempt_id: request.attempt_id as string,
      });
    });
  });

  it("still cancels locally when the sidecar cancel endpoint is too slow", async () => {
    await withFakeSidecar(
      { invokeHold: true, cancelDelayMs: 500 },
      async (sidecar) => {
        const adapter = createAgentScopeAdapter(
          testConfig(sidecar.url, { cancelTimeoutMs: 150 }),
        );
        const request = await makeInvokeRequest("c-cancel-slow");
        const pending = adapter.invoke(request);
        await waitFor(() =>
          sidecar.requests.some((r) => r.path === "/invoke"),
        );
        const cancelResult = await adapter.cancel(request.attempt_id, T2);
        assert.equal(cancelResult.cancelled, true, "local abort suffices");
        const result = await pending;
        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.error.code, "cancelled");
        sidecar.behavior.invokeHold = false;
        sidecar.releaseHeld();
      },
    );
  });

  it("reports cancelled=false for an unknown attempt the sidecar denies", async () => {
    await withFakeSidecar({ cancelCancelled: false }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.cancel(branded("att-unknown"), T2);
      assert.equal(result.cancelled, false);
      assert.equal(result.attempt_id, branded("att-unknown"));
    });
  });

  it("acknowledges a remotely-known attempt even without local in-flight state", async () => {
    await withFakeSidecar({ cancelCancelled: true }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const result = await adapter.cancel(branded("att-remote"), T2);
      assert.equal(result.cancelled, true);
    });
  });
});

// ---------------------------------------------------------------------------
// Protocol discipline and Motor semantics
// ---------------------------------------------------------------------------

describe("agentscope adapter: protocol discipline and Motor semantics", () => {
  it("only ever speaks the three protocol endpoints (no tools, no MCP)", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      await adapter.health(T1);
      await adapter.invoke(await makeInvokeRequest("c-paths"));
      await adapter.cancel(branded("att-paths"), T2);
      assert.ok(sidecar.requests.length >= 3);
      for (const request of sidecar.requests) {
        assert.ok(
          ["/health", "/invoke", "/cancel"].includes(request.path),
          `unexpected sidecar path: ${request.path}`,
        );
      }
    });
  });

  it("runs the shared fixture with identical Employee/Task/context/policy semantics as the fakes", async () => {
    await withFakeSidecar({}, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const viaFake = await runTaskThroughAdapter(
        createFakeAlphaAdapter(),
        fixture,
        createRunIds("sem-fake"),
      );
      const viaAgentScope = await runTaskThroughAdapter(
        adapter,
        fixture,
        createRunIds("sem-agentscope"),
      );
      assert.equal(viaAgentScope.result.ok, true);
      assert.equal(viaFake.result.ok, true);
      if (!viaAgentScope.result.ok || !viaFake.result.ok) {
        throw new Error("unreachable: both runs asserted ok");
      }
      // Same Task, same Employee delegation, same manifest items and policy.
      assert.equal(
        viaAgentScope.agent.delegated_by,
        viaFake.agent.delegated_by,
      );
      assert.deepEqual(viaAgentScope.manifest.items, viaFake.manifest.items);
      assert.deepEqual(viaAgentScope.manifest.policy, viaFake.manifest.policy);
      // Only the operational binding may differ.
      assert.notEqual(
        viaAgentScope.result.meta.adapter_id,
        viaFake.result.meta.adapter_id,
      );
      // The full causal evidence chain of the AgentScope run is valid.
      const chain = buildEvidenceChain(viaAgentScope.evidence);
      assert.equal(chain.ok, true);
      assert.equal(findOrphans(viaAgentScope.evidence).length, 0);
    });
  });

  it("turns an adapter failure into terminal Motor state plus causal evidence", async () => {
    await withFakeSidecar({ invokeStatus: 500 }, async (sidecar) => {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("c-terminal");
      const result = await adapter.invoke(request);
      assert.equal(result.ok, false);
      if (result.ok) return;

      const task_id = fixture.task.task_id;
      const { run_id, attempt_id } = request;
      const events: EngineEvent[] = [
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded("evt-c-terminal-run-started"),
          seq: 1,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          type: "run.started",
          occurred_at: T1,
        },
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded("evt-c-terminal-att-started"),
          seq: 2,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          attempt_id,
          type: "attempt.started",
          occurred_at: T1,
        },
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded("evt-c-terminal-att-failed"),
          seq: 3,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          attempt_id,
          type: "attempt.failed",
          occurred_at: T2,
        },
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded("evt-c-terminal-run-failed"),
          seq: 4,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          type: "run.failed",
          occurred_at: T2,
        },
      ];
      let projection = initialKernelProjection();
      for (const event of events) {
        projection = applyEngineEvent(projection, event);
      }
      assert.equal(
        projection.tasks[task_id as string]?.status,
        "failed",
        "failure ends in a controlled terminal Motor state, never a hanging Attempt",
      );

      const evTask = makeEvidenceRecord({
        evidence_id: branded("ev-c-terminal-task"),
        stage: "task",
        task_id,
        subject_id: task_id as string,
        kind_detail: "task.assigned",
        data: { employee_id: fixture.employee.employee_id },
        occurred_at: T1,
      });
      const evRun = makeEvidenceRecord({
        evidence_id: branded("ev-c-terminal-run"),
        stage: "run",
        task_id,
        run_id,
        subject_id: run_id as string,
        parent_evidence_id: evTask.evidence_id,
        kind_detail: "run.started",
        data: { engine: "proof-harness" },
        occurred_at: T1,
      });
      const evAttempt = makeEvidenceRecord({
        evidence_id: branded("ev-c-terminal-attempt"),
        stage: "attempt",
        task_id,
        run_id,
        attempt_id,
        subject_id: attempt_id as string,
        parent_evidence_id: evRun.evidence_id,
        kind_detail: "context.manifest.bound",
        data: { adapter_id: adapter.adapter_id },
        occurred_at: T1,
      });
      const evFailure = makeEvidenceRecord({
        evidence_id: branded("ev-c-terminal-failure"),
        stage: "artifact",
        task_id,
        run_id,
        attempt_id,
        subject_id: "artifact-c-terminal",
        parent_evidence_id: evAttempt.evidence_id,
        kind_detail: "adapter.result",
        data: { error: result.error },
        occurred_at: T3,
      });
      const evidence = [evTask, evRun, evAttempt, evFailure];
      const chain = buildEvidenceChain(evidence);
      assert.equal(chain.ok, true);
      assert.equal(findOrphans(evidence).length, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// Static guards on the real sidecar and its infra (no Python needed in CI)
// ---------------------------------------------------------------------------

describe("agentscope sidecar source and infra guards", () => {
  it("sidecar.py registers no tools, imports no MCP, inits no telemetry", async () => {
    const source = await readFile(
      new URL("./adapters/agentscope/sidecar.py", import.meta.url),
      "utf8",
    );
    assert.ok(
      !source.includes("register_tool_function"),
      "no tool may ever be registered",
    );
    assert.ok(
      !/(^|\s)(import|from)\s+mcp(\s|\.|$)/m.test(source),
      "the MCP client library is never imported",
    );
    assert.ok(
      !source.includes("agentscope.init("),
      "agentscope.init is never called: tracing/telemetry stays off",
    );
    assert.ok(
      source.includes("get_json_schemas"),
      "the startup empty-Toolkit assertion is present",
    );
  });

  it("compose.agentscope.yaml keeps the isolation boundary", async () => {
    const raw = await readFile(
      new URL("../infra/pilot/compose.agentscope.yaml", import.meta.url),
      "utf8",
    );
    // Strip comment lines so documented prohibitions don't trip the guard.
    const source = raw
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    assert.ok(!source.includes("network_mode: host"), "no host networking");
    assert.ok(!/^volumes:/m.test(source), "no volumes at all");
    assert.ok(
      !source.includes("PILOT_STORE_SECRET"),
      "the store secret never enters the sidecar",
    );
    assert.ok(
      source.includes("127.0.0.1:4410:4410"),
      "Motor-facing port publishes on host loopback only",
    );
    assert.ok(
      source.includes("OTEL_SDK_DISABLED"),
      "telemetry disabled at the platform level too",
    );
  });

  it("Dockerfile pins the base image digest and verifies the wheel hash", async () => {
    const source = await readFile(
      new URL("../infra/pilot/agentscope/Dockerfile", import.meta.url),
      "utf8",
    );
    assert.ok(source.includes("python:3.12.12-slim@sha256:"), "pinned base");
    assert.ok(
      source.includes(
        "091e7f214eff7fd6f4934d98a7d7c4bb8707a5d4b33d335def7fc31255e7ccb8",
      ),
      "PyPI wheel sha256 verified before install",
    );
    assert.ok(!source.includes("agentscope["), "no extras installed");
  });
});
