/**
 * mcp-attacks.test.ts — P0.6 spoor C, aanvalspunten 5 en 9.
 *
 * Malformed protocolberichten en MCP-scopeaanvallen. Twee lagen:
 *  - handler-niveau (in-process, synthetische provider);
 *  - HTTP-niveau via de echte /mcp-route van createPilotServer (ACL,
 *    content-type, parse-fouten, notification-discipline op 127.0.0.1).
 *
 * Iedere aanval moet eindigen in DENY / found:false / geen response —
 * nooit in stil succes, een crash of een hangende request. Twee tests
 * (S9d, S9f) asserten het VEILIGE gewenste gedrag dat de huidige code
 * mogelijk niet haalt: als ze falen zijn dat escalaties, geen
 * testfouten — zie LANE-C-SECURITY.md.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createFakeAlphaAdapter } from "../../lib/adr110/adapters/fake-alpha.ts";
import { createHermesAdapter } from "../../lib/adr110/adapters/hermes/adapter.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
} from "../../lib/adr110/scenario.ts";
import { createMcpPilotHandler } from "../mcp/server.ts";
import { MCP_TOOL_NAME } from "../mcp/policy.ts";
import type {
  RawRunSnapshot,
  RunSnapshotScope,
} from "../mcp/snapshot.ts";
import { createStoreSnapshotProvider } from "../mcp/store-provider.ts";
import type { DraftStoreRecord } from "../draft-store.ts";
import { createPilotServer, parseAcl } from "../server.ts";

const WS_MOTOR = "ws-motor";

interface RpcResultShape {
  readonly result?: {
    readonly isError?: boolean;
    readonly _meta?: { readonly motor_decision?: string; readonly reason?: string };
    readonly structuredContent?: Record<string, unknown>;
  };
  readonly error?: {
    readonly code: number;
    readonly data?: { readonly motor_decision?: string; readonly reason?: string };
  };
}

function syntheticRaw(runId: string): RawRunSnapshot {
  return {
    task_id: "task-sec-1",
    run_id: runId,
    status: "completed",
    attempt_id: "att-sec-1",
    adapter_id: "fake",
    adapter_version: "1.0.0",
    evidence: [],
    evaluation_status: "green",
    data_class: "internal",
    context_text: "SEC-CONTEXT-markering",
    draft_text: "SEC-DRAFT-markering",
  };
}

function createProbe(runId = "run-sec-1") {
  const calls: RunSnapshotScope[] = [];
  const provider = {
    getRunSnapshot: async (scope: RunSnapshotScope) => {
      calls.push(scope);
      return syntheticRaw(runId);
    },
  };
  const handle = createMcpPilotHandler({ workspaceId: WS_MOTOR, provider });
  return { handle, calls };
}

let rpcId = 0;
function rpc(method: string, params?: unknown, id?: unknown) {
  const message: Record<string, unknown> = {
    jsonrpc: "2.0",
    method,
    ...(params === undefined ? {} : { params }),
  };
  if (id !== undefined) message.id = id;
  else message.id = ++rpcId;
  return message;
}

function callTool(args: unknown, id?: unknown) {
  return rpc("tools/call", { name: MCP_TOOL_NAME, arguments: args }, id);
}

const VALID_ARGS = {
  workspace_id: WS_MOTOR,
  task_id: "task-sec-1",
  run_id: "run-sec-1",
};

function assertDeny(response: unknown, label: string): void {
  const shaped = response as RpcResultShape;
  const decision =
    shaped.result?._meta?.motor_decision ?? shaped.error?.data?.motor_decision;
  assert.equal(decision, "DENY", `${label}: verwachtte DENY, kreeg ${JSON.stringify(response)}`);
}

test("S5a. handler: niet-JSON-RPC berichten → invalid_request DENY, driver nooit aangeroepen", async () => {
  const { handle, calls } = createProbe();
  const garbage: unknown[] = [
    null,
    42,
    "tools/call",
    [rpc("tools/list")],
    [],
    { hello: "world" },
    { jsonrpc: "1.0", id: 1, method: "tools/list" },
    { jsonrpc: 2.0, id: 1, method: "tools/list" },
    { jsonrpc: "2.0", id: 1 },
    { jsonrpc: "2.0", id: 1, method: 42 },
    { jsonrpc: "2.0", id: 1, method: null },
  ];
  for (const message of garbage) {
    const response = (await handle(message)) as RpcResultShape;
    assert.ok(response !== null, `geen antwoord op ${JSON.stringify(message)}`);
    assert.equal(response.error?.code, -32600, JSON.stringify(message));
    assert.equal(response.error?.data?.reason, "invalid_request");
    assertDeny(response, JSON.stringify(message));
  }
  assert.equal(calls.length, 0, "de read-driver werd nooit bereikt");
});

test("S5b. handler: onbekende methode mét id → method_not_found DENY", async () => {
  const { handle, calls } = createProbe();
  for (const method of [
    "resources/write",
    "tools/invoke",
    "motor.admin",
    "prompts/get",
    "tools/call ",
    "Tools/Call",
  ]) {
    const response = await handle(rpc(method, {}));
    assertDeny(response, method);
  }
  assert.equal(calls.length, 0);
});

test("S5c. adaptergrens: kapotte sidecar-antwoorden blijven terminale DENY (steekproef)", async () => {
  // De lane-tests dekken de volledige malformed-matrix per adapter; hier
  // de cross-cutting eigenschap: géén enkele kapotte response wordt ooit
  // een ok-resultaat en géén enkele call hangt langer dan de timeout.
  const adapter = createHermesAdapter({
    baseUrl: "http://127.0.0.1:4410",
    invokeTimeoutMs: 100,
    handshakeTimeoutMs: 100,
    fetchImpl: (async () =>
      new Response("\u0000\u0001\u0002 binaire troep", {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  });
  const seed = await runTaskThroughAdapter(
    createFakeAlphaAdapter(),
    buildProofFixture(),
    createRunIds("sec-malformed"),
  );
  const started = Date.now();
  const result = await adapter.invoke({
    task_id: seed.manifest.task_id,
    run_id: seed.run_id,
    attempt_id: seed.attempt_id,
    manifest: seed.manifest,
    agent: seed.agent,
    runtime: seed.runtime,
    model: seed.model,
    input: "x",
  });
  assert.ok(Date.now() - started < 5_000, "geen hang");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "malformed_response");
  assert.equal(result.error.retryable, false);
});

test("S9a. tools/call: extra argumenten → DENY (ook proto-sleutels en spatievarianten)", async () => {
  const { handle, calls } = createProbe();
  const attacks: unknown[] = [
    { ...VALID_ARGS, include_context: true },
    { ...VALID_ARGS, admin: true },
    JSON.parse('{"workspace_id":"ws-motor","task_id":"task-sec-1","run_id":"run-sec-1","__proto__":{}}'),
    { ...VALID_ARGS, "run_id ": "run-sec-1" },
    { ...VALID_ARGS, workspace_id: WS_MOTOR, extra: { nested: "object" } },
  ];
  for (const args of attacks) {
    const response = await handle(callTool(args));
    assertDeny(response, JSON.stringify(args));
    const shaped = response as RpcResultShape;
    assert.equal(shaped.result?._meta?.reason, "invalid_arguments");
  }
  assert.equal(calls.length, 0);
});

test("S9b. tools/call: verkeerde types → DENY", async () => {
  const { handle, calls } = createProbe();
  const attacks: unknown[] = [
    { ...VALID_ARGS, run_id: 42 },
    { ...VALID_ARGS, run_id: null },
    { ...VALID_ARGS, run_id: ["run-sec-1"] },
    { ...VALID_ARGS, run_id: { id: "run-sec-1" } },
    { ...VALID_ARGS, run_id: "" },
    { ...VALID_ARGS, task_id: true },
    { ...VALID_ARGS, workspace_id: 0 },
  ];
  for (const args of attacks) {
    const response = await handle(callTool(args));
    assertDeny(response, JSON.stringify(args));
  }
  assert.equal(calls.length, 0);
});

test("S9c. tools/call: params zelf is geen object → DENY", async () => {
  const { handle, calls } = createProbe();
  for (const params of [null, "x", [1, 2], 42]) {
    const response = await handle(rpc("tools/call", params));
    assertDeny(response, String(params));
  }
  // arguments ontbreekt of is geen object → DENY.
  for (const params of [
    { name: MCP_TOOL_NAME },
    { name: MCP_TOOL_NAME, arguments: null },
    { name: MCP_TOOL_NAME, arguments: "ws-motor" },
    { name: MCP_TOOL_NAME, arguments: [WS_MOTOR] },
  ]) {
    const response = await handle(rpc("tools/call", params));
    assertDeny(response, JSON.stringify(params));
  }
  assert.equal(calls.length, 0);
});

test("S9d. notification zonder id → NOOIT een response en nooit een read (ESCALATIE-gevoelig)", async () => {
  const { handle, calls } = createProbe();
  // Echte notification (zonder id): bekend patroon.
  const initialized: Record<string, unknown> = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  };
  assert.equal(await handle(initialized), null);
  // Onbekende methode zonder id: ook geen antwoord.
  const unknownNotification: Record<string, unknown> = {
    jsonrpc: "2.0",
    method: "resources/write",
    params: {},
  };
  assert.equal(await handle(unknownNotification), null);
  // Een tools/call ZONDER id is per JSON-RPC 2.0 een notification: de
  // server MAG NIET antwoorden en de read mag niet uitgevoerd worden.
  // Faalt dit, dan beantwoordt de handler notifications alsnog (met id:
  // null) — een protocolbreuk die in LANE-C-SECURITY.md geëscaleerd is.
  const callNotification: Record<string, unknown> = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: MCP_TOOL_NAME, arguments: VALID_ARGS },
  };
  const response = await handle(callNotification);
  assert.equal(response, null, "een tools/call-notification kreeg toch een response");
  assert.equal(calls.length, 0, "een notification mocht nooit de read-driver bereiken");
});

test("S9e. run_id van een andere workspace via de store-provider → nooit data over de grens", async () => {
  // Sinds P0.8 dragen records verplicht een workspace-kolom; de grens mag
  // een run van een VREEMDE workspace nooit als eigen snapshot teruggeven.
  const drafts: DraftStoreRecord[] = [
    {
      type: "draft",
      workspace_id: "ws-motor",
      stored_at: new Date().toISOString(),
      run_id: "run-van-ws-motor",
      receipt_id: "rcpt-x",
      synthetic: true,
      review: "SEC-REVIEW-markering",
      draft: "SEC-DRAFT-markering",
    },
  ];
  const provider = createStoreSnapshotProvider({
    listDrafts: async () => drafts,
    workspaceId: "ws-anders",
  });
  // Direct: scope met vreemde workspace → null.
  assert.equal(
    await provider.getRunSnapshot({
      workspace_id: WS_MOTOR,
      task_id: "t",
      run_id: "run-van-ws-motor",
    }),
    null,
  );
  // Via de handler van de ANDERE boundary: de run hoort bij ws-motor en
  // mag voor ws-anders hooguit found:false zijn — nooit een snapshot.
  const handle = createMcpPilotHandler({ workspaceId: "ws-anders", provider });
  const response = (await handle(
    callTool({ workspace_id: "ws-anders", task_id: "t", run_id: "run-van-ws-motor" }),
  )) as RpcResultShape;
  const content = response.result?.structuredContent;
  assert.equal(
    content?.found,
    false,
    "run van ws-motor werd aan ws-anders geserveerd — cross-workspace lek",
  );
});

test("S9f. HTTP /mcp: cross-workspace run_id vanaf een andere node → DENY/leeg (ESCALATIE-gevoelig)", async () => {
  const drafts: DraftStoreRecord[] = [
    {
      type: "draft",
      // P0.8: verplichte tenancy-kolom; het record hoort aantoonbaar bij
      // ws-motor en mag dus nooit bij ws-anders opduiken.
      workspace_id: "ws-motor",
      stored_at: new Date().toISOString(),
      run_id: "run-van-ws-motor",
      receipt_id: "rcpt-x",
      synthetic: true,
      review: "SEC-REVIEW-markering",
      draft: "SEC-DRAFT-markering",
    },
  ];
  const server = createPilotServer({
    acl: parseAcl('{"nA-MOTOR":["ws-motor"],"nB-ANDERS":["ws-anders"]}'),
    // De testclient is de aanvaller: node B met alleen ws-anders in de ACL.
    resolveNode: async () => ({ stableId: "nB-ANDERS", name: "node-b" }),
    listDraftsImpl: (async () => drafts) as never,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    // Node B (alleen ws-anders) vraagt de run van ws-motor op. De routes
    // matchen req.url exact, dus géén querystring: met één ACL-workspace
    // kent accessCheck automatisch ws-anders toe.
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: MCP_TOOL_NAME,
          arguments: {
            workspace_id: "ws-anders",
            task_id: "task-x",
            run_id: "run-van-ws-motor",
          },
        },
      }),
    });
    const json = (await response.json()) as {
      result?: { structuredContent?: { found?: boolean }; _meta?: { motor_decision?: string } };
    };
    const leaked = json.result?.structuredContent?.found !== false;
    assert.ok(
      !leaked,
      `cross-workspace snapshot geserveerd: ${JSON.stringify(json).slice(0, 200)}`,
    );
    // En zelfs áls het ooit zou lekken: nooit ruwe inhoud over de lijn.
    assert.ok(!JSON.stringify(json).includes("SEC-DRAFT-markering"));
    assert.ok(!JSON.stringify(json).includes("SEC-REVIEW-markering"));
  } finally {
    server.close();
  }
});

test("S5d. HTTP /mcp: malformed matrix — 415/400/DENY, nooit crash of hang", async () => {
  const server = createPilotServer({
    acl: parseAcl('{"nA-MOTOR":["ws-motor"]}'),
    resolveNode: async () => ({ stableId: "nA-MOTOR", name: "node-a" }),
    listDraftsImpl: (async () => []) as never,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    // Geen of verkeerde content-type → 415.
    for (const headers of [
      {},
      { "content-type": "text/plain" },
      { "content-type": "application/x-www-form-urlencoded" },
    ]) {
      const res = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: headers as HeadersInit,
        body: "x",
      });
      assert.equal(res.status, 415, JSON.stringify(headers));
      assert.equal((await res.json()).error, "content_type_must_be_json");
    }
    // Kapotte JSON-body → 400.
    const badJson = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{kapot",
    });
    assert.equal(badJson.status, 400);
    // Geldige JSON maar geen JSON-RPC → 200 met RPC-fout + DENY-marker.
    const notRpc = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    assert.equal(notRpc.status, 200);
    const notRpcJson = (await notRpc.json()) as RpcResultShape;
    assert.equal(notRpcJson.error?.code, -32600);
    assert.equal(notRpcJson.error?.data?.motor_decision, "DENY");
    // Notification → 202 en een LEEGE body.
    const notification = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    assert.equal(notification.status, 202);
    assert.equal(await notification.text(), "");
    // De server leeft nog en serveert normaal verder (geen crash/hang).
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
  } finally {
    server.close();
  }
});
