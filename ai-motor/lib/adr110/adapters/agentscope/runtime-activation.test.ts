/**
 * runtime-activation.test.ts — P0.6 lane-B proof for the ACTIVATED AgentScope
 * sidecar seam. Complements pilot/agentscope.test.ts (lane C, untouched):
 *
 * - terminal failure evidence: every phase-0 failure mode (unavailable,
 *   timeout, cancelled, malformed_response) ends in a controlled terminal
 *   Motor state with a valid causal evidence chain — no hanging Attempt,
 *   no orphans;
 * - protocol version: the real sidecar declares and serves
 *   "motor-sidecar/1" and the adapter accepts that exact response shape;
 * - static guards on the activated artifacts: sidecar.py invariants (no
 *   tools, no MCP import, no agentscope.init, empty-toolkit assertion, no
 *   hidden retry), requirements-lock.txt full transitive hash-lock,
 *   Dockerfile --require-hashes-only install, fake_model.py stdlib-only.
 *
 * Runtime tests run against a deterministic FAKE sidecar (a Node http
 * server inside this file). REAL_CONTEXT_USED=no, EXTERNAL_EFFECTS=no.
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
  applyEngineEvent,
  initialKernelProjection,
  type EngineEvent,
} from "../../engine.ts";
import {
  buildEvidenceChain,
  findOrphans,
  makeEvidenceRecord,
} from "../../evidence.ts";
import {
  buildProofFixture,
  createRunIds,
  PROOF_WORKSPACE_ID,
  runTaskThroughAdapter,
  T1,
  T2,
  T3,
} from "../../scenario.ts";
import { ADR110_SCHEMA_VERSION, branded } from "../../types.ts";
import type {
  AdapterError,
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "../contract.ts";
import {
  AGENTSCOPE_PROTOCOL_LIMITS,
  createAgentScopeAdapter,
  type AgentScopeSidecarConfig,
} from "./sidecar-client.ts";

const fixture = buildProofFixture();

// ---------------------------------------------------------------------------
// Minimal deterministic fake sidecar (same protocol, lane-B behaviors only)
// ---------------------------------------------------------------------------

interface FakeBehavior {
  invokeStatus?: number;
  invokeRawBody?: string;
  invokeHold?: boolean;
}

interface FakeSidecar {
  readonly url: string;
  readonly close: () => Promise<void>;
}

async function startFakeSidecar(behavior: FakeBehavior): Promise<FakeSidecar> {
  const held: Array<() => void> = [];

  function respondJson(res: ServerResponse, status: number, payload: unknown) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  }

  function safe(respond: () => void): () => void {
    return () => {
      try {
        respond();
      } catch {
        // Late bytes after a client abort are discarded by the transport.
      }
    };
  }

  function route(req: IncomingMessage, res: ServerResponse, body: string) {
    if (req.method === "GET" && req.url === "/health") {
      respondJson(res, 200, { status: "ok", protocol: "motor-sidecar/1" });
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
          respondJson(res, status, {
            error: "fake failure",
            protocol: "motor-sidecar/1",
          });
          return;
        }
        if (behavior.invokeRawBody !== undefined) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(behavior.invokeRawBody);
          return;
        }
        respondJson(res, 200, {
          output: `synthetic draft: ${String(parsed.input ?? "")}`,
          task_id: parsed.task_id,
          run_id: parsed.run_id,
          attempt_id: parsed.attempt_id,
          protocol: "motor-sidecar/1",
        });
      });
      if (behavior.invokeHold) held.push(respond);
      else respond();
      return;
    }
    if (req.method === "POST" && req.url === "/cancel") {
      respondJson(res, 200, {
        cancelled: true,
        protocol: "motor-sidecar/1",
      });
      return;
    }
    respondJson(res, 404, { error: "not_found", protocol: "motor-sidecar/1" });
  }

  const server: Server = createServer((req, res) => {
    res.on("error", () => undefined);
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => route(req, res, body));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const release of held.splice(0)) release();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
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

/** Minimal inline fake adapter: only the shared fixture machinery
 *  (manifest/agent/run ids) is needed to build real invoke requests. */
function createFixtureAdapter(): CapabilityAdapter {
  return {
    adapter_id: "fake-runtime-activation",
    adapter_version: "0.0.1",
    capabilities: ["draft.generate"],
    requirements: { data_classes: ["public", "internal"], network: "none" },
    health: (now) => ({
      adapter_id: "fake-runtime-activation",
      adapter_version: "0.0.1",
      status: "ok",
      checked_at: now,
    }),
    invoke: (request) => ({
      ok: true,
      output: "fixture draft",
      meta: {
        adapter_id: "fake-runtime-activation",
        adapter_version: "0.0.1",
        simulated_latency_ms: 0,
        simulated_cost_cents: 0,
        task_id: request.task_id,
        run_id: request.run_id,
        attempt_id: request.attempt_id,
      },
    }),
    cancel: (attempt_id) => ({ cancelled: true, attempt_id }),
  };
}

async function makeInvokeRequest(label: string): Promise<AdapterInvokeRequest> {
  const run = await runTaskThroughAdapter(
    createFixtureAdapter(),
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

/**
 * The phase-0 termination contract: an adapter failure must end in a
 * controlled terminal Motor state with causal failure evidence — never in a
 * hanging Attempt. Proven per failure mode below.
 */
function assertTerminalMotorState(
  label: string,
  request: AdapterInvokeRequest,
  error: AdapterError,
): void {
  const { task_id, run_id, attempt_id } = request;
  const events: EngineEvent[] = [
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-b-${label}-run-started`),
      seq: 1,
      workspace_id: PROOF_WORKSPACE_ID,
      task_id,
      run_id,
      type: "run.started",
      occurred_at: T1,
    },
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-b-${label}-att-started`),
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
      event_id: branded(`evt-b-${label}-att-failed`),
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
      event_id: branded(`evt-b-${label}-run-failed`),
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
    evidence_id: branded(`ev-b-${label}-task`),
    stage: "task",
    task_id,
    subject_id: task_id as string,
    kind_detail: "task.assigned",
    data: { employee_id: fixture.employee.employee_id },
    occurred_at: T1,
  });
  const evRun = makeEvidenceRecord({
    evidence_id: branded(`ev-b-${label}-run`),
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
    evidence_id: branded(`ev-b-${label}-attempt`),
    stage: "attempt",
    task_id,
    run_id,
    attempt_id,
    subject_id: attempt_id as string,
    parent_evidence_id: evRun.evidence_id,
    kind_detail: "context.manifest.bound",
    data: { adapter_id: "agentscope" },
    occurred_at: T1,
  });
  const evFailure = makeEvidenceRecord({
    evidence_id: branded(`ev-b-${label}-failure`),
    stage: "artifact",
    task_id,
    run_id,
    attempt_id,
    subject_id: `artifact-b-${label}`,
    parent_evidence_id: evAttempt.evidence_id,
    kind_detail: "adapter.result",
    data: { error },
    occurred_at: T3,
  });
  const evidence = [evTask, evRun, evAttempt, evFailure];
  const chain = buildEvidenceChain(evidence);
  assert.equal(chain.ok, true, "causal failure-evidence chain is valid");
  assert.equal(findOrphans(evidence).length, 0, "no orphan evidence");
}

function assertTerminalError(
  result: AdapterResult,
  request: AdapterInvokeRequest,
  code: string,
  retryable: boolean,
): AdapterError {
  assert.equal(result.ok, false, "invoke must fail terminally");
  if (result.ok) throw new Error("unreachable: asserted !ok");
  assert.equal(result.error.code, code);
  assert.equal(result.error.retryable, retryable);
  assert.equal(result.error.task_id, request.task_id);
  assert.equal(result.error.run_id, request.run_id);
  assert.equal(result.error.attempt_id, request.attempt_id);
  return result.error;
}

// ---------------------------------------------------------------------------
// Terminal failure evidence (phase-0 taxonomy)
// ---------------------------------------------------------------------------

describe("agentscope runtime: terminal failure evidence", () => {
  it("unavailable (HTTP 500) terminates with causal evidence", async () => {
    const sidecar = await startFakeSidecar({ invokeStatus: 500 });
    try {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("b-unavailable-500");
      const result = await adapter.invoke(request);
      const error = assertTerminalError(result, request, "unavailable", true);
      assertTerminalMotorState("unavailable-500", request, error);
    } finally {
      await sidecar.close();
    }
  });

  it("unavailable (connection refused) terminates with causal evidence", async () => {
    const sidecar = await startFakeSidecar({});
    const url = sidecar.url;
    await sidecar.close();
    const adapter = createAgentScopeAdapter(testConfig(url));
    const request = await makeInvokeRequest("b-unavailable-refused");
    const result = await adapter.invoke(request);
    const error = assertTerminalError(result, request, "unavailable", true);
    assertTerminalMotorState("unavailable-refused", request, error);
  });

  it("timeout (invoke beyond the bounded wait) terminates with causal evidence", async () => {
    const sidecar = await startFakeSidecar({ invokeHold: true });
    try {
      const adapter = createAgentScopeAdapter(
        testConfig(sidecar.url, { invokeTimeoutMs: 150 }),
      );
      const request = await makeInvokeRequest("b-timeout");
      const result = await adapter.invoke(request);
      const error = assertTerminalError(result, request, "timeout", true);
      assertTerminalMotorState("timeout", request, error);
    } finally {
      await sidecar.close();
    }
  });

  it("cancelled (Motor cancels an in-flight attempt) terminates with causal evidence", async () => {
    const sidecar = await startFakeSidecar({ invokeHold: true });
    try {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("b-cancelled");
      const pending = adapter.invoke(request);
      // invoke() registers the attempt synchronously before its first await,
      // so cancel() deterministically finds it in flight.
      const cancelResult = await adapter.cancel(request.attempt_id, T2);
      const result = await pending;
      assert.equal(cancelResult.cancelled, true);
      const error = assertTerminalError(result, request, "cancelled", false);
      assertTerminalMotorState("cancelled", request, error);
    } finally {
      await sidecar.close();
    }
  });

  it("malformed_response (non-JSON body) terminates with causal evidence", async () => {
    const sidecar = await startFakeSidecar({ invokeRawBody: "<html>broken" });
    try {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("b-malformed");
      const result = await adapter.invoke(request);
      const error = assertTerminalError(
        result,
        request,
        "malformed_response",
        false,
      );
      assertTerminalMotorState("malformed", request, error);
    } finally {
      await sidecar.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Protocol version "motor-sidecar/1"
// ---------------------------------------------------------------------------

describe("agentscope runtime: protocol version", () => {
  it("the adapter accepts the real sidecar response shape (protocol field + echo)", async () => {
    const sidecar = await startFakeSidecar({});
    try {
      const adapter = createAgentScopeAdapter(testConfig(sidecar.url));
      const request = await makeInvokeRequest("b-protocol");
      const result = await adapter.invoke(request);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.ok(result.output.includes("synthetic draft"));
      assert.equal(result.meta.attempt_id, request.attempt_id);
      const health = await adapter.health(T1);
      assert.equal(health.status, "ok");
    } finally {
      await sidecar.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Static guards on the activated artifacts (no Python needed in CI)
// ---------------------------------------------------------------------------

const SIDECAR_PY = new URL(
  "../../../../pilot/adapters/agentscope/sidecar.py",
  import.meta.url,
);
const FAKE_MODEL_PY = new URL(
  "../../../../pilot/adapters/agentscope/fake_model.py",
  import.meta.url,
);
const REQUIREMENTS_LOCK = new URL(
  "../../../../pilot/adapters/agentscope/requirements-lock.txt",
  import.meta.url,
);
const DOCKERFILE = new URL(
  "../../../../infra/pilot/agentscope/Dockerfile",
  import.meta.url,
);

describe("agentscope runtime: artifact guards", () => {
  it("sidecar.py declares and serves protocol motor-sidecar/1", async () => {
    const source = await readFile(SIDECAR_PY, "utf8");
    assert.ok(
      source.includes('PROTOCOL_VERSION = "motor-sidecar/1"'),
      "protocol version constant present",
    );
    assert.ok(
      source.includes('"protocol": PROTOCOL_VERSION'),
      "every response envelope carries the protocol version",
    );
  });

  it("sidecar.py keeps the lane-C invariants after activation", async () => {
    const source = await readFile(SIDECAR_PY, "utf8");
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
      source.includes("get_tool_schemas"),
      "the 2.0.6 empty-Toolkit startup assertion is present",
    );
    assert.ok(
      source.includes("get_json_schemas"),
      "the lane-C assertion reference is preserved",
    );
    assert.ok(
      !source.includes("memory"),
      "no memory backend is configured",
    );
  });

  it("sidecar.py disables hidden retry at both client levels", async () => {
    const source = await readFile(SIDECAR_PY, "utf8");
    assert.ok(
      /^\s+max_retries=0,$/m.test(source),
      "agentscope model constructed with max_retries=0",
    );
    assert.ok(
      source.includes('"max_retries": 0'),
      "openai client constructed with max_retries=0",
    );
  });

  it("requirements-lock.txt is a full transitive hash-lock", async () => {
    const source = await readFile(REQUIREMENTS_LOCK, "utf8");
    assert.ok(
      source.includes("agentscope==2.0.6"),
      "the direct dependency stays exactly pinned",
    );
    assert.ok(
      source.includes(
        "--hash=sha256:091e7f214eff7fd6f4934d98a7d7c4bb8707a5d4b33d335def7fc31255e7ccb8",
      ),
      "the lane-C audited wheel sha256 is the pinned artifact",
    );
    assert.ok(!source.includes("agentscope["), "no extras locked");
    const packageLines = source
      .split("\n")
      .filter((line) => /^[a-z0-9_.-]+==/i.test(line));
    assert.ok(
      packageLines.length >= 50,
      "the lock covers the transitive closure",
    );
    const hashes = source.match(/^\s+--hash=sha256:[0-9a-f]{64}/gm) ?? [];
    assert.ok(
      hashes.length >= packageLines.length,
      "every locked package carries at least one sha256",
    );
  });

  it("Dockerfile installs only from the lock with --require-hashes", async () => {
    const source = await readFile(DOCKERFILE, "utf8");
    assert.ok(source.includes("python:3.12.12-slim@sha256:"), "pinned base");
    assert.ok(
      source.includes("requirements-lock.txt"),
      "the lock is the install source",
    );
    assert.ok(
      source.includes("--require-hashes"),
      "hash-verified install is enforced",
    );
    const pipInstallLines = source
      .split("\n")
      .filter((line) => line.includes("pip install"));
    assert.ok(pipInstallLines.length > 0);
    for (const line of pipInstallLines) {
      assert.ok(
        line.includes("--require-hashes"),
        `pip install without --require-hashes: ${line.trim()}`,
      );
    }
    assert.ok(!source.includes("pip download"), "no unhashed download step");
    assert.ok(!source.includes("agentscope["), "no extras installed");
  });

  it("fake_model.py is a stdlib-only stub with the two required endpoints", async () => {
    const source = await readFile(FAKE_MODEL_PY, "utf8");
    assert.ok(
      !/(^|\s)(import|from)\s+(mcp|agentscope|openai|httpx)(\s|\.|$)/m.test(
        source,
      ),
      "the fake model never imports the real SDKs",
    );
    assert.ok(source.includes('"/v1/chat/completions"'));
    assert.ok(source.includes('"/v1/models"'));
    const dockerfile = await readFile(DOCKERFILE, "utf8");
    assert.ok(
      !dockerfile.includes("fake_model"),
      "test tooling never enters the production image",
    );
  });

  it("protocol limits stay at the phase-0 bounds", () => {
    assert.equal(AGENTSCOPE_PROTOCOL_LIMITS.MAX_BODY_BYTES, 1_048_576);
    assert.equal(AGENTSCOPE_PROTOCOL_LIMITS.MAX_INVOKE_TIMEOUT_MS, 120_000);
    assert.equal(AGENTSCOPE_PROTOCOL_LIMITS.MAX_SHORT_TIMEOUT_MS, 5_000);
  });
});
