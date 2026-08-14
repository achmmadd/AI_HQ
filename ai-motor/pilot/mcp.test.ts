/**
 * Spoor D — bewijzen voor het read-only MCP-pad:
 *
 *  1. geldig scoped synthetisch readverzoek levert een gesanitiseerde snapshot;
 *  2. onbekende tool → DENY;
 *  3. extra/ongeldig argument → DENY;
 *  4. cross-workspace mismatch → DENY;
 *  5. write/publish/mail/payment/device-control-intenties → DENY;
 *  6. ontbrekende scope/velden → DENY;
 *  7. response bevat nooit contextpayload, secret, host/IP of niet-
 *     geallowliste velden;
 *  8. duplicate read is veilig maar krijgt afzonderlijke evidence-ID's;
 *  9. de driver kan geen write-interface ontvangen (read-only by construction);
 * 10. de SDK read-only annotation én Motor-enforcement zijn beide aanwezig.
 *
 * Alle data is synthetisch en in-memory; er is geen netwerk, geen filesystem
 * en geen legacy-import (scripts/motors-http-mcp.mjs wordt bewust niet
 * gewrapt).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { branded, isoTimestamp } from "../lib/adr110/index.ts";
import type {
  EvidenceId,
  RunId,
  TaskId,
} from "../lib/adr110/index.ts";
import { makeEvidenceRecord } from "../lib/adr110/evidence.ts";
import type { EvidenceRecord } from "../lib/adr110/types.ts";
import {
  MCP_PROTOCOL_VERSION,
  createMcpPilotHandler,
} from "./mcp/server.ts";
import { MCP_TOOL_NAME } from "./mcp/policy.ts";
import type {
  RawRunSnapshot,
  RunSnapshotProvider,
  RunSnapshotScope,
} from "./mcp/snapshot.ts";

const WORKSPACE = "ws-motor";
const MARKER_CONTEXT = "GEHEIM-CONTEXT-MARKER-linde-prive-8374";
const MARKER_DRAFT = "GEHEIM-DRAFT-MARKER-nooit-tonen-5521";
const MARKER_HOST = "100.99.88.77";

function syntheticEvidence(): readonly EvidenceRecord[] {
  const now = isoTimestamp(new Date().toISOString());
  const task = branded<TaskId>("task-synth-1");
  const run = branded<RunId>("run-synth-1");
  const evTask = makeEvidenceRecord({
    evidence_id: branded<EvidenceId>("ev-synth-task"),
    stage: "task",
    task_id: task,
    kind_detail: "synthetic",
    data: { synthetic: true },
    occurred_at: now,
  });
  const evRun = makeEvidenceRecord({
    evidence_id: branded<EvidenceId>("ev-synth-run"),
    stage: "run",
    task_id: task,
    run_id: run,
    parent_evidence_id: evTask.evidence_id,
    kind_detail: "synthetic",
    data: { synthetic: true },
    occurred_at: now,
  });
  return [evTask, evRun];
}

function syntheticRaw(): RawRunSnapshot {
  return {
    task_id: "task-synth-1",
    run_id: "run-synth-1",
    status: "completed",
    attempt_id: "att-synth-1",
    adapter_id: "fake",
    adapter_version: "1.0.0",
    artifact_id: "art-1",
    artifact_digest: "a".repeat(64),
    draft_id: "draft-1",
    draft_digest: "b".repeat(64),
    evidence: syntheticEvidence(),
    evaluation_status: "green",
    data_class: "internal",
    // Bewust gevoelige velden: mogen de sanitizer nooit passeren.
    context_text: MARKER_CONTEXT,
    draft_text: MARKER_DRAFT,
  };
}

function createProvider(
  raw: RawRunSnapshot | null = syntheticRaw(),
): { provider: RunSnapshotProvider; calls: RunSnapshotScope[] } {
  const calls: RunSnapshotScope[] = [];
  const provider: RunSnapshotProvider = {
    getRunSnapshot: async (scope) => {
      calls.push(scope);
      return raw;
    },
  };
  return { provider, calls };
}

function createHandler(raw: RawRunSnapshot | null = syntheticRaw()) {
  const { provider, calls } = createProvider(raw);
  const handle = createMcpPilotHandler({ workspaceId: WORKSPACE, provider });
  return { handle, provider, calls };
}

let rpcId = 0;
function callTool(
  name: unknown,
  args: unknown,
): { jsonrpc: "2.0"; id: number; method: "tools/call"; params: unknown } {
  return {
    jsonrpc: "2.0",
    id: ++rpcId,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

const VALID_ARGS = {
  workspace_id: WORKSPACE,
  task_id: "task-synth-1",
  run_id: "run-synth-1",
};

test("D1. geldig scoped readverzoek → gesanitiseerde snapshot + evidence", async () => {
  const { handle, calls } = createHandler();
  const response = (await handle(callTool(MCP_TOOL_NAME, VALID_ARGS))) as {
    result: {
      isError: boolean;
      structuredContent: Record<string, unknown>;
      _meta: { motor_decision: string; evidence_ids: string[] };
    };
  };
  assert.equal(response.result.isError, false);
  assert.equal(response.result._meta.motor_decision, "ALLOW");
  const snap = response.result.structuredContent;
  assert.equal(snap.schema_version, "motor.pilot.run_snapshot/v1");
  assert.equal(snap.status, "completed");
  assert.equal(snap.scope, "run.snapshot.read");
  assert.equal(calls.length, 1, "driver exact één keer aangeroepen");
  assert.deepEqual(calls[0], VALID_ARGS);
  const evidence = snap.evidence as { record_count: number; chain_valid: boolean };
  assert.equal(evidence.record_count, 2);
  assert.equal(evidence.chain_valid, true);
  assert.equal(response.result._meta.evidence_ids.length, 5);
});

test("D2. onbekende tool → DENY, driver nooit aangeroepen", async () => {
  const { handle, calls } = createHandler();
  const response = (await handle(
    callTool("motor.pilot.list_everything", VALID_ARGS),
  )) as { result: { isError: boolean; _meta: { motor_decision: string; reason: string } } };
  assert.equal(response.result.isError, true);
  assert.equal(response.result._meta.motor_decision, "DENY");
  assert.equal(response.result._meta.reason, "unknown_tool");
  assert.equal(calls.length, 0);
});

test("D3. extra of ongeldig argument → DENY", async () => {
  const { handle, calls } = createHandler();
  const extra = (await handle(
    callTool(MCP_TOOL_NAME, { ...VALID_ARGS, include_context: true }),
  )) as { result: { _meta: { motor_decision: string; reason: string } } };
  assert.equal(extra.result._meta.motor_decision, "DENY");
  assert.equal(extra.result._meta.reason, "invalid_arguments");

  const wrongType = (await handle(
    callTool(MCP_TOOL_NAME, { ...VALID_ARGS, run_id: 42 }),
  )) as { result: { _meta: { motor_decision: string } } };
  assert.equal(wrongType.result._meta.motor_decision, "DENY");
  assert.equal(calls.length, 0);
});

test("D4. cross-workspace mismatch → DENY", async () => {
  const { handle, calls } = createHandler();
  const response = (await handle(
    callTool(MCP_TOOL_NAME, { ...VALID_ARGS, workspace_id: "ws-anders" }),
  )) as { result: { _meta: { motor_decision: string; reason: string } } };
  assert.equal(response.result._meta.motor_decision, "DENY");
  assert.equal(response.result._meta.reason, "cross_workspace");
  assert.equal(calls.length, 0);
});

test("D5. write/publish/mail/payment/device-control → altijd DENY", async () => {
  const { handle, calls } = createHandler();
  const intents = [
    "motor.pilot.publish_draft",
    "motor.pilot.write",
    "motor.mail.send",
    "motor.payment.create",
    "motor.device.control",
    "review.reply.publish",
  ];
  for (const name of intents) {
    const response = (await handle(callTool(name, VALID_ARGS))) as {
      result: { isError: boolean; _meta: { motor_decision: string } };
    };
    assert.equal(response.result.isError, true, name);
    assert.equal(response.result._meta.motor_decision, "DENY", name);
  }
  // Ook write-achtige RPC-methoden bestaan niet.
  const writeMethod = (await handle({
    jsonrpc: "2.0",
    id: 999,
    method: "resources/write",
    params: {},
  })) as { error: { code: number; data: { motor_decision: string } } };
  assert.equal(writeMethod.error.data.motor_decision, "DENY");
  assert.equal(calls.length, 0);
});

test("D6. ontbrekende scope-velden → DENY", async () => {
  const { handle, calls } = createHandler();
  for (const args of [
    { task_id: "t", run_id: "r" },
    { workspace_id: WORKSPACE, run_id: "r" },
    { workspace_id: WORKSPACE, task_id: "t" },
    {},
  ]) {
    const response = (await handle(callTool(MCP_TOOL_NAME, args))) as {
      result: { _meta: { motor_decision: string } };
    };
    assert.equal(response.result._meta.motor_decision, "DENY");
  }
  assert.equal(calls.length, 0);
});

test("D7. response bevat nooit context, secret, host/IP of vreemde velden", async () => {
  const { handle } = createHandler();
  const response = (await handle(callTool(MCP_TOOL_NAME, VALID_ARGS))) as {
    result: { structuredContent: Record<string, unknown> };
  };
  const serialized = JSON.stringify(response);
  assert.ok(!serialized.includes(MARKER_CONTEXT), "geen contextpayload");
  assert.ok(!serialized.includes(MARKER_DRAFT), "geen draft-inhoud");
  assert.ok(!serialized.includes(MARKER_HOST), "geen host/IP");
  assert.ok(!serialized.includes("secret"), "geen secret-velden");
  const snap = response.result.structuredContent;
  const allowed = new Set([
    "schema_version",
    "workspace_id",
    "task_id",
    "run_id",
    "status",
    "attempt_id",
    "adapter",
    "artifacts",
    "draft",
    "evidence",
    "evaluation_status",
    "data_class",
    "scope",
    "redactions",
  ]);
  for (const key of Object.keys(snap)) {
    assert.ok(allowed.has(key), `niet-geallowlist veld in snapshot: ${key}`);
  }
  assert.deepEqual(snap.redactions, ["context_text", "draft_text"]);
});

test("D8. duplicate read is veilig maar krijgt afzonderlijke evidence-ID's", async () => {
  const { handle, calls } = createHandler();
  const first = (await handle(callTool(MCP_TOOL_NAME, VALID_ARGS))) as {
    result: { _meta: { evidence_ids: string[] } };
  };
  const second = (await handle(callTool(MCP_TOOL_NAME, VALID_ARGS))) as {
    result: { _meta: { evidence_ids: string[] } };
  };
  assert.equal(calls.length, 2, "read mag herhaald worden");
  const overlap = first.result._meta.evidence_ids.filter((id) =>
    second.result._meta.evidence_ids.includes(id),
  );
  assert.deepEqual(overlap, [], "geen gedeelde evidence-ID's tussen reads");
});

test("D9. de driver ontvangt geen write-interface (read-only by construction)", async () => {
  const { provider } = createProvider();
  assert.deepEqual(
    Object.keys(provider),
    ["getRunSnapshot"],
    "de provider exposeert exact één getter en geen write-surface",
  );
  // En de handler accepteert alleen dat contract: een object mét extra
  // write-methoden wordt nooit aangeroepen anders dan via getRunSnapshot.
  const hostile = {
    getRunSnapshot: async () => syntheticRaw(),
    write: async () => {
      throw new Error("write may never be called");
    },
    delete: async () => {
      throw new Error("delete may never be called");
    },
  };
  const handle = createMcpPilotHandler({
    workspaceId: WORKSPACE,
    provider: hostile,
  });
  const response = (await handle(callTool(MCP_TOOL_NAME, VALID_ARGS))) as {
    result: { isError: boolean };
  };
  assert.equal(response.result.isError, false);
});

test("D10. SDK read-only annotation én Motor-enforcement zijn beide aanwezig", async () => {
  const { handle } = createHandler();
  const listed = (await handle({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  })) as {
    result: {
      tools: {
        name: string;
        annotations: Record<string, unknown>;
        inputSchema: { additionalProperties: boolean };
      }[];
    };
  };
  assert.equal(listed.result.tools.length, 1, "exact één tool geregistreerd");
  const tool = listed.result.tools[0];
  assert.equal(tool.name, MCP_TOOL_NAME);
  assert.equal(tool.annotations.readOnlyHint, true, "SDK-hint aanwezig");
  assert.equal(tool.annotations.destructiveHint, false);
  assert.equal(tool.inputSchema.additionalProperties, false);

  // De hint alleen is geen enforcement: zonder Motor-policy zou een client
  // de hint kunnen negeren. De gateway Dwingt af: een write-intentie is DENY
  // ondanks dat de client "readOnly" claimt te respecteren.
  const denied = (await handle(callTool("motor.pilot.write", VALID_ARGS))) as {
    result: { _meta: { motor_decision: string } };
  };
  assert.equal(denied.result._meta.motor_decision, "DENY");
});

test("D11. initialize spreekt het vastgelegde protocol; onbekende methode DENY", async () => {
  const { handle } = createHandler();
  const init = (await handle({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {} },
  })) as {
    result: { protocolVersion: string; serverInfo: { name: string } };
  };
  assert.equal(init.result.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.equal(init.result.serverInfo.name, "motor-pilot-mcp");

  const unknown = (await handle({
    jsonrpc: "2.0",
    id: 2,
    method: "prompts/get",
    params: {},
  })) as { error: { code: number; data: { motor_decision: string } } };
  assert.equal(unknown.error.code, -32601);
  assert.equal(unknown.error.data.motor_decision, "DENY");

  const garbage = (await handle({ hello: "world" })) as {
    error: { code: number; data: { motor_decision: string } };
  };
  assert.equal(garbage.error.code, -32600);
  assert.equal(garbage.error.data.motor_decision, "DENY");
});

test("D12. run onbekend bij de driver → found:false, geen fout, wél evidence", async () => {
  const { handle } = createHandler(null);
  const response = (await handle(callTool(MCP_TOOL_NAME, VALID_ARGS))) as {
    result: {
      isError: boolean;
      structuredContent: { found: boolean };
      _meta: { motor_decision: string; evidence_ids: string[] };
    };
  };
  assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent.found, false);
  assert.equal(response.result._meta.evidence_ids.length, 5);
});
