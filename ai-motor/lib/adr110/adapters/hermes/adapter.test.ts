/**
 * hermes adapter tests — contract conformance against a fake sidecar.
 *
 * The fake sidecar is a scripted in-process fetch implementation that
 * speaks the phase-0 HTTP/JSON protocol at the fetch boundary: zero
 * sockets, zero real network I/O. One test at the end proves the actual
 * wire format against an in-process HTTP server on 127.0.0.1 (same
 * loopback pattern as pilot/boundary.test.ts) — never an external host.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { ADAPTER_CONTRACT_MEMBERS } from "../contract.ts";
import type {
  AdapterInvokeRequest,
  CapabilityAdapter,
} from "../contract.ts";
import { createFakeAlphaAdapter } from "../fake-alpha.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
  T1,
} from "../../scenario.ts";
import { branded } from "../../types.ts";
import type { AttemptId } from "../../types.ts";
import {
  createHermesAdapter,
  HERMES_ADAPTER_ID,
  HERMES_ADAPTER_VERSION,
  HERMES_ERROR_CODES,
  HERMES_MAX_BODY_BYTES,
} from "./adapter.ts";
import type { HermesAdapterConfig } from "./adapter.ts";

/** Fictive loopback endpoint — no real service is contacted in tests. */
const BASE_URL = "http://127.0.0.1:4410";

const fixture = buildProofFixture();

interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

type SidecarHandler = (
  call: RecordedRequest,
  init?: RequestInit,
) => Response | Promise<Response>;

interface FakeSidecar {
  readonly fetchImpl: typeof fetch;
  readonly calls: RecordedRequest[];
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Scripted in-process fake sidecar: records requests, delegates answers. */
function createFakeSidecar(handler: SidecarHandler): FakeSidecar {
  const calls: RecordedRequest[] = [];
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const call: RecordedRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      body:
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : init?.body,
    };
    calls.push(call);
    return handler(call, init);
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

/** Protocol-correct happy path: health ok, invoke echoes the causal ids. */
function okHandler(call: RecordedRequest): Response {
  if (call.url.endsWith("/health")) {
    return jsonResponse(200, { status: "ok" });
  }
  if (call.url.endsWith("/invoke")) {
    const body = call.body as {
      task_id: string;
      run_id: string;
      attempt_id: string;
    };
    return jsonResponse(200, {
      output: "hermes-sidecar draft",
      task_id: body.task_id,
      run_id: body.run_id,
      attempt_id: body.attempt_id,
    });
  }
  if (call.url.endsWith("/cancel")) {
    return jsonResponse(200, { cancelled: true });
  }
  return jsonResponse(404, {});
}

function echoOf(call: RecordedRequest): Record<string, unknown> {
  const body = call.body as {
    task_id: string;
    run_id: string;
    attempt_id: string;
  };
  return {
    task_id: body.task_id,
    run_id: body.run_id,
    attempt_id: body.attempt_id,
  };
}

/** Never settles until the adapter's abort/timeout signal fires. */
function pendingUntilAbort(init?: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener("abort", () => reject(signal.reason));
  });
}

function makeAdapter(
  sidecar: FakeSidecar,
  overrides?: Partial<HermesAdapterConfig>,
): CapabilityAdapter {
  return createHermesAdapter({
    baseUrl: BASE_URL,
    invokeTimeoutMs: 1_000,
    handshakeTimeoutMs: 200,
    ...overrides,
    fetchImpl: sidecar.fetchImpl,
  });
}

/**
 * Request fixture built through the PURE fake-alpha adapter, so the hermes
 * adapter under test is only invoked explicitly inside each test — also on
 * paths where the scripted sidecar always answers an error.
 */
async function seedRequest(
  label: string,
  input = "Draft a friendly reply to review #42",
): Promise<AdapterInvokeRequest> {
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
    input,
  };
}

describe("adapter contract: hermes", () => {
  it("exposes exactly the contract members (statelessness by shape)", () => {
    const adapter = makeAdapter(createFakeSidecar(okHandler));
    assert.deepEqual(
      Object.keys(adapter).sort(),
      [...ADAPTER_CONTRACT_MEMBERS].sort(),
    );
    assert.ok(Object.isFrozen(adapter));
  });

  it("declares id, version, capabilities and requirements", () => {
    const adapter = makeAdapter(createFakeSidecar(okHandler));
    assert.equal(adapter.adapter_id, HERMES_ADAPTER_ID);
    assert.equal(adapter.adapter_id, "hermes");
    assert.match(adapter.adapter_version, /^\d+\.\d+\.\d+$/);
    assert.equal(adapter.adapter_version, HERMES_ADAPTER_VERSION);
    assert.ok(adapter.capabilities.includes("draft.generate"));
    assert.equal(adapter.requirements.network, "egress");
    assert.ok(adapter.requirements.data_classes.includes("internal"));
    assert.ok(adapter.requirements.data_classes.includes("public"));
  });

  it("uses exactly the phase-0 error taxonomy, no adapter-specific codes", () => {
    assert.deepEqual(
      [...HERMES_ERROR_CODES].sort(),
      [
        "cancelled",
        "causal_mismatch",
        "malformed_response",
        "timeout",
        "unavailable",
      ],
    );
    assert.ok(Object.isFrozen(HERMES_ERROR_CODES));
  });

  it("rejects invalid configuration (no usable endpoint, over-limit timeouts)", () => {
    assert.throws(
      () => createHermesAdapter({ baseUrl: "not-a-url" }),
      /not a valid URL/,
    );
    assert.throws(
      () => createHermesAdapter({ baseUrl: "ftp://127.0.0.1:4410" }),
      /must be http/,
    );
    assert.throws(
      () =>
        createHermesAdapter({ baseUrl: BASE_URL, invokeTimeoutMs: 120_001 }),
      /invokeTimeoutMs/,
    );
    assert.throws(
      () =>
        createHermesAdapter({ baseUrl: BASE_URL, handshakeTimeoutMs: 5_001 }),
      /handshakeTimeoutMs/,
    );
    assert.throws(
      () => createHermesAdapter({ baseUrl: BASE_URL, invokeTimeoutMs: 0 }),
      /invokeTimeoutMs/,
    );
  });
});

describe("hermes health", () => {
  it("reports ok at the injected time", async () => {
    const adapter = makeAdapter(createFakeSidecar(okHandler));
    const health = await adapter.health(T1);
    assert.equal(health.status, "ok");
    assert.equal(health.adapter_id, "hermes");
    assert.equal(health.checked_at, T1);
  });

  it("passes degraded through", async () => {
    const adapter = makeAdapter(
      createFakeSidecar(() => jsonResponse(200, { status: "degraded" })),
    );
    const health = await adapter.health(T1);
    assert.equal(health.status, "degraded");
  });

  it("reports down on network failure, never throws", async () => {
    const adapter = makeAdapter(
      createFakeSidecar(() => {
        throw new TypeError("fetch failed");
      }),
    );
    const health = await adapter.health(T1);
    assert.equal(health.status, "down");
    assert.equal(health.checked_at, T1);
  });

  it("reports down on a malformed or wrong-schema health answer", async () => {
    const notJson = makeAdapter(
      createFakeSidecar(
        () => new Response("not json", { status: 200 }),
      ),
    );
    assert.equal((await notJson.health(T1)).status, "down");

    const wrongSchema = makeAdapter(
      createFakeSidecar(() => jsonResponse(200, { status: "banana" })),
    );
    assert.equal((await wrongSchema.health(T1)).status, "down");

    const httpError = makeAdapter(
      createFakeSidecar(() => jsonResponse(503, { status: "ok" })),
    );
    assert.equal((await httpError.health(T1)).status, "down");
  });

  it("reports down when the handshake timeout is exceeded", async () => {
    const adapter = makeAdapter(
      createFakeSidecar((_call, init) => pendingUntilAbort(init)),
      { handshakeTimeoutMs: 30 },
    );
    assert.equal((await adapter.health(T1)).status, "down");
  });
});

describe("hermes invoke", () => {
  it("sends exactly the phase-0 protocol body and echoes the causal ids", async () => {
    const sidecar = createFakeSidecar(okHandler);
    const adapter = makeAdapter(sidecar);
    const request = await seedRequest("hermes-ok");
    const result = await adapter.invoke(request);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.output, "hermes-sidecar draft");
    assert.equal(result.meta.adapter_id, "hermes");
    assert.equal(result.meta.adapter_version, HERMES_ADAPTER_VERSION);
    assert.equal(result.meta.task_id, request.task_id);
    assert.equal(result.meta.run_id, request.run_id);
    assert.equal(result.meta.attempt_id, request.attempt_id);
    assert.equal(typeof result.meta.simulated_latency_ms, "number");
    assert.ok(result.meta.simulated_latency_ms >= 0);
    assert.equal(result.meta.simulated_cost_cents, 0);

    // The wire body carries the causal ids + input and NOTHING else:
    // no manifest, agent, runtime or model data crosses the boundary.
    assert.equal(sidecar.calls.length, 1);
    const call = sidecar.calls[0];
    assert.equal(call.url, `${BASE_URL}/invoke`);
    assert.equal(call.method, "POST");
    assert.deepEqual(
      Object.keys(call.body as Record<string, unknown>).sort(),
      ["attempt_id", "input", "run_id", "task_id"],
    );
    assert.deepEqual(call.body, {
      task_id: request.task_id as string,
      run_id: request.run_id as string,
      attempt_id: request.attempt_id as string,
      input: request.input,
    });
  });

  it("maps a wrong causal echo to causal_mismatch (terminal)", async () => {
    const sidecar = createFakeSidecar((call) =>
      jsonResponse(200, {
        ...echoOf(call),
        attempt_id: "att-VERVALST",
        output: "forged echo",
      }),
    );
    const adapter = makeAdapter(sidecar);
    const request = await seedRequest("hermes-mismatch");
    const result = await adapter.invoke(request);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "causal_mismatch");
    assert.equal(result.error.retryable, false);
    assert.equal(result.error.task_id, request.task_id);
    assert.equal(result.error.run_id, request.run_id);
    assert.equal(result.error.attempt_id, request.attempt_id);
  });

  const malformedCases: readonly [
    string,
    (call: RecordedRequest) => Response,
  ][] = [
    ["non-JSON body", () => new Response("not json", { status: 200 })],
    ["missing output", (call) => jsonResponse(200, echoOf(call))],
    [
      "non-string output",
      (call) => jsonResponse(200, { ...echoOf(call), output: 42 }),
    ],
    [
      "empty output",
      (call) => jsonResponse(200, { ...echoOf(call), output: "" }),
    ],
    [
      "oversized declared content-length",
      (call) =>
        new Response(
          JSON.stringify({ ...echoOf(call), output: "x" }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": String(HERMES_MAX_BODY_BYTES + 1),
            },
          },
        ),
    ],
    [
      "oversized actual body",
      (call) =>
        jsonResponse(200, {
          ...echoOf(call),
          output: "x".repeat(HERMES_MAX_BODY_BYTES),
        }),
    ],
    ["HTTP 4xx", () => jsonResponse(400, { error: "bad request" })],
  ];
  for (const [name, respond] of malformedCases) {
    it(`maps ${name} to malformed_response (terminal)`, async () => {
      const adapter = makeAdapter(createFakeSidecar(respond));
      const request = await seedRequest(`hermes-malformed-${name}`);
      const result = await adapter.invoke(request);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "malformed_response");
      assert.equal(result.error.retryable, false);
      assert.equal(result.error.attempt_id, request.attempt_id);
    });
  }

  const unavailableCases: readonly [
    string,
    (call: RecordedRequest) => Response,
  ][] = [
    [
      "network failure",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
    ["HTTP 500", () => jsonResponse(500, { error: "boom" })],
    ["HTTP 429", () => jsonResponse(429, { error: "slow down" })],
    ["HTTP 503", () => jsonResponse(503, { error: " restarting" })],
  ];
  for (const [name, respond] of unavailableCases) {
    it(`maps ${name} to unavailable (retryable)`, async () => {
      const adapter = makeAdapter(createFakeSidecar(respond));
      const request = await seedRequest(`hermes-unavailable-${name}`);
      const result = await adapter.invoke(request);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "unavailable");
      assert.equal(result.error.retryable, true);
      assert.equal(result.error.attempt_id, request.attempt_id);
    });
  }

  it("maps an exceeded invoke timeout to timeout (retryable)", async () => {
    const adapter = makeAdapter(
      createFakeSidecar((_call, init) => pendingUntilAbort(init)),
      { invokeTimeoutMs: 30 },
    );
    const request = await seedRequest("hermes-timeout");
    const result = await adapter.invoke(request);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "timeout");
    assert.equal(result.error.retryable, true);
  });

  it("refuses a request over the 1 MiB protocol bound without any network call", async () => {
    const sidecar = createFakeSidecar(okHandler);
    const adapter = makeAdapter(sidecar);
    const request = await seedRequest(
      "hermes-oversized-request",
      "x".repeat(HERMES_MAX_BODY_BYTES),
    );
    const result = await adapter.invoke(request);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "malformed_response");
    assert.equal(result.error.retryable, false);
    assert.equal(sidecar.calls.length, 0);
  });
});

describe("hermes cancel (async seam, phase-0 decision 1)", () => {
  it("returns a Promise (async-capable cancel)", async () => {
    const adapter = makeAdapter(createFakeSidecar(okHandler));
    const pending = adapter.cancel(branded("att-none"), T1);
    assert.ok(pending instanceof Promise);
    await pending;
  });

  it("cancels an in-flight invoke: local abort + sidecar /cancel", async () => {
    const sidecar = createFakeSidecar((call, init) => {
      if (call.url.endsWith("/invoke")) return pendingUntilAbort(init);
      if (call.url.endsWith("/cancel")) {
        return jsonResponse(200, { cancelled: true });
      }
      return jsonResponse(200, { status: "ok" });
    });
    const adapter = makeAdapter(sidecar);
    const request = await seedRequest("hermes-cancel-inflight");

    const invokePromise = adapter.invoke(request);
    const cancelResult = await adapter.cancel(request.attempt_id, T1);
    assert.equal(cancelResult.cancelled, true);
    assert.equal(cancelResult.attempt_id, request.attempt_id);

    const result = await invokePromise;
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "cancelled");
    assert.equal(result.error.retryable, false);
    assert.equal(result.error.attempt_id, request.attempt_id);

    const cancelCall = sidecar.calls.find((c) => c.url.endsWith("/cancel"));
    assert.equal(cancelCall?.method, "POST");
    assert.deepEqual(cancelCall?.body, {
      attempt_id: request.attempt_id as string,
    });
  });

  it("reports the local abort even when the sidecar cannot be reached", async () => {
    const sidecar = createFakeSidecar((call, init) => {
      if (call.url.endsWith("/invoke")) return pendingUntilAbort(init);
      throw new TypeError("fetch failed");
    });
    const adapter = makeAdapter(sidecar);
    const request = await seedRequest("hermes-cancel-unreachable");

    const invokePromise = adapter.invoke(request);
    const cancelResult = await adapter.cancel(request.attempt_id, T1);
    assert.equal(cancelResult.cancelled, true);

    const result = await invokePromise;
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "cancelled");
  });

  it("echoes cancelled=false for an unknown attempt", async () => {
    const adapter = makeAdapter(
      createFakeSidecar(() => jsonResponse(200, { cancelled: false })),
    );
    const result = await adapter.cancel(branded("att-onbekend"), T1);
    assert.equal(result.cancelled, false);
    assert.equal(result.attempt_id, branded("att-onbekend"));
  });

  it("never throws when the sidecar is unreachable and nothing is in flight", async () => {
    const adapter = makeAdapter(
      createFakeSidecar(() => {
        throw new TypeError("fetch failed");
      }),
    );
    const result = await adapter.cancel(branded("att-niets"), T1);
    assert.equal(result.cancelled, false);
    assert.equal(result.attempt_id, branded("att-niets"));
  });
});

describe("hermes wire protocol (in-process loopback HTTP, no external network)", () => {
  interface SeenRequest {
    method?: string;
    url?: string;
    contentType?: string;
    body: string;
  }

  it("speaks the phase-0 protocol over real HTTP on 127.0.0.1", async () => {
    const seen: SeenRequest[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf8");
      });
      req.on("end", () => {
        seen.push({
          method: req.method,
          url: req.url,
          contentType: req.headers["content-type"],
          body,
        });
        res.setHeader("content-type", "application/json");
        if (req.url === "/health" && req.method === "GET") {
          res.end(JSON.stringify({ status: "ok" }));
          return;
        }
        if (req.url === "/invoke" && req.method === "POST") {
          const parsed = JSON.parse(body) as {
            task_id: string;
            run_id: string;
            attempt_id: string;
          };
          res.end(
            JSON.stringify({
              output: "wire-draft",
              task_id: parsed.task_id,
              run_id: parsed.run_id,
              attempt_id: parsed.attempt_id,
            }),
          );
          return;
        }
        if (req.url === "/cancel" && req.method === "POST") {
          res.end(JSON.stringify({ cancelled: true }));
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not_found" }));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");
    try {
      const adapter = createHermesAdapter({
        baseUrl: `http://127.0.0.1:${address.port}`,
        invokeTimeoutMs: 5_000,
        handshakeTimeoutMs: 2_000,
      });

      const health = await adapter.health(T1);
      assert.equal(health.status, "ok");

      const request = await seedRequest("hermes-wire");
      const result = await adapter.invoke(request);
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.output, "wire-draft");

      const cancel = await adapter.cancel(branded<AttemptId>("att-wire"), T1);
      assert.equal(cancel.cancelled, true);
      assert.equal(cancel.attempt_id, branded("att-wire"));

      const healthSeen = seen.find((s) => s.url === "/health");
      assert.equal(healthSeen?.method, "GET");

      const invokeSeen = seen.find((s) => s.url === "/invoke");
      assert.equal(invokeSeen?.method, "POST");
      assert.equal(invokeSeen?.contentType, "application/json");
      const invokeBody = JSON.parse(invokeSeen?.body ?? "{}") as Record<
        string,
        unknown
      >;
      assert.deepEqual(Object.keys(invokeBody).sort(), [
        "attempt_id",
        "input",
        "run_id",
        "task_id",
      ]);
      assert.equal(invokeBody.task_id, request.task_id as string);
      assert.equal(invokeBody.run_id, request.run_id as string);
      assert.equal(invokeBody.attempt_id, request.attempt_id as string);

      const cancelSeen = seen.find((s) => s.url === "/cancel");
      assert.equal(cancelSeen?.method, "POST");
      assert.deepEqual(JSON.parse(cancelSeen?.body ?? "{}"), {
        attempt_id: "att-wire",
      });
    } finally {
      server.close();
    }
  });
});
