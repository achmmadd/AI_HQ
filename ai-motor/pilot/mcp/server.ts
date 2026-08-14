/**
 * Motor pilot MCP boundary — a minimal, dependency-free JSON-RPC 2.0 handler
 * speaking the MCP tool surface (initialize / tools/list / tools/call).
 *
 * MCP is transport only. Authority stays with Motor: every read goes through
 * exact-schema validation, workspace scope check, policy evaluation and the
 * Gateway (evaluate → mint → execute) before the injected read-only driver
 * is touched. Everything unknown — tool names, methods, arguments,
 * workspaces, write-ish intents — fails closed with motor_decision: "DENY".
 *
 * The tool descriptor carries the SDK annotation shape (readOnlyHint etc.)
 * as client hints; those hints enforce nothing — the policy does.
 * Protocol compatibility target: @modelcontextprotocol/sdk protocol
 * 2025-06-18 (pin deferred to integration; no dependency added here because
 * package.json is shared sprint surface outside this lane's scope).
 *
 * No legacy import: scripts/motors-http-mcp.mjs is a broad mutating proxy
 * and is deliberately not wrapped or reused.
 */

import {
  ADR110_SCHEMA_VERSION,
  branded,
  deepFreeze,
  isoTimestamp,
} from "../../lib/adr110/index.ts";
import type {
  ActionRequest,
  AttemptId,
  EmployeeId,
  EvidenceId,
  RunId,
  TaskId,
  WorkspaceId,
} from "../../lib/adr110/index.ts";
import { createGateway } from "../../lib/adr110/gateway.ts";
import { makeEvidenceRecord } from "../../lib/adr110/evidence.ts";
import type { EvidenceRecord } from "../../lib/adr110/types.ts";
import {
  MCP_READ_CAPABILITY,
  MCP_TOOL_NAME,
  buildMcpReadPolicy,
} from "./policy.ts";
import {
  sanitizeSnapshot,
  type RunSnapshotProvider,
  type SanitizedRunSnapshot,
} from "./snapshot.ts";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_NAME = "motor-pilot-mcp";
export const MCP_SERVER_VERSION = "0.1.0";

export interface McpPilotDeps {
  /** The only workspace this boundary serves; anything else is DENY. */
  readonly workspaceId: string;
  /** Read-only driver, injected. CI uses synthetic in-memory data only. */
  readonly provider: RunSnapshotProvider;
  readonly now?: () => string;
}

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

/** Tool-level refusal: valid JSON-RPC, but Motor denies the call. */
function toolDeny(reason: string, extra?: Record<string, unknown>) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `DENY: ${reason}`,
      },
    ],
    _meta: { motor_decision: "DENY", reason, ...extra },
  };
}

const TOOL_DESCRIPTOR = deepFreeze({
  name: MCP_TOOL_NAME,
  title: "Read one sanitized pilot run snapshot",
  description:
    "Read-only. Returns ids, digests, statuses and evidence-chain metadata " +
    "for one run — never raw context, draft content, secrets or hosts.",
  inputSchema: deepFreeze({
    type: "object",
    properties: deepFreeze({
      workspace_id: deepFreeze({ type: "string", minLength: 1 }),
      task_id: deepFreeze({ type: "string", minLength: 1 }),
      run_id: deepFreeze({ type: "string", minLength: 1 }),
    }),
    required: ["workspace_id", "task_id", "run_id"],
    additionalProperties: false,
  }),
  // SDK annotation shape — hints for clients only. Motor enforces.
  annotations: deepFreeze({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
});

const ALLOWED_ARGUMENT_KEYS = ["workspace_id", "task_id", "run_id"] as const;

export function createMcpPilotHandler(deps: McpPilotDeps) {
  const workspaceId = branded<WorkspaceId>(deps.workspaceId);
  const policy = buildMcpReadPolicy(workspaceId);
  const gateway = createGateway(policy);
  const now = () => isoTimestamp(deps.now?.() ?? new Date().toISOString());
  let evidenceCounter = 0;
  const nextEvidenceId = (): EvidenceId =>
    branded<EvidenceId>(
      `ev-mcp-${++evidenceCounter}-${Math.random().toString(36).slice(2, 10)}`,
    );

  async function callReadSnapshot(id: JsonRpcId, params: unknown) {
    if (!isObject(params)) {
      return rpcResult(id, toolDeny("invalid_params", { detail: "params must be an object" }));
    }
    if (params.name !== MCP_TOOL_NAME) {
      return rpcResult(
        id,
        toolDeny("unknown_tool", { requested: String(params.name) }),
      );
    }
    const args = params.arguments;
    if (!isObject(args)) {
      return rpcResult(id, toolDeny("invalid_arguments", { detail: "arguments must be an object" }));
    }
    const keys = Object.keys(args).sort();
    if (
      keys.length !== ALLOWED_ARGUMENT_KEYS.length ||
      !ALLOWED_ARGUMENT_KEYS.every((k, i) => keys[i] === k)
    ) {
      return rpcResult(
        id,
        toolDeny("invalid_arguments", {
          detail: "exactly workspace_id, task_id and run_id; no extra keys",
        }),
      );
    }
    for (const key of ALLOWED_ARGUMENT_KEYS) {
      if (typeof args[key] !== "string" || (args[key] as string).length === 0) {
        return rpcResult(id, toolDeny("invalid_arguments", { detail: `${key} must be a non-empty string` }));
      }
    }
    const scope = {
      workspace_id: args.workspace_id as string,
      task_id: args.task_id as string,
      run_id: args.run_id as string,
    };
    if (scope.workspace_id !== deps.workspaceId) {
      return rpcResult(id, toolDeny("cross_workspace", { detail: "workspace outside this boundary" }));
    }

    // Motor authority: policy evaluation via the gateway. The capability is
    // the only one this policy knows; anything else is DENY by construction.
    const timestamp = now();
    const request: ActionRequest = deepFreeze({
      schema_version: ADR110_SCHEMA_VERSION,
      action_id: branded(`act-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      workspace_id: workspaceId,
      task_id: branded<TaskId>(scope.task_id),
      run_id: branded<RunId>(scope.run_id),
      attempt_id: branded<AttemptId>(`att-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      capability: MCP_READ_CAPABILITY,
      tool: MCP_TOOL_NAME,
      args: deepFreeze({ ...scope }),
      data_class: "internal",
      estimated_cost_cents: 0,
      requested_by: branded<EmployeeId>("employee-mcp-reader"),
      requested_at: timestamp,
    });
    const evaluation = gateway.evaluate(request, timestamp);
    if (evaluation.decision !== "ALLOW") {
      return rpcResult(
        id,
        toolDeny("gateway_denied", { reasons: [...evaluation.reasons] }),
      );
    }
    const minted = gateway.mintReceipt(request, timestamp);
    if (!minted.ok) {
      return rpcResult(id, toolDeny("gateway_denied", { reasons: [...minted.reasons] }));
    }
    const execution = gateway.executeAction(request, minted.receipt, timestamp);
    if (!execution.executed) {
      return rpcResult(id, toolDeny("gateway_denied", { reasons: [execution.reason] }));
    }

    // Evidence chain for THIS read — duplicate reads get fresh ids.
    const evTask = makeEvidenceRecord({
      evidence_id: nextEvidenceId(),
      stage: "task",
      task_id: request.task_id,
      kind_detail: "mcp.read.request",
      data: { tool: MCP_TOOL_NAME },
      occurred_at: timestamp,
    });
    const evRun = makeEvidenceRecord({
      evidence_id: nextEvidenceId(),
      stage: "run",
      task_id: request.task_id,
      run_id: request.run_id,
      parent_evidence_id: evTask.evidence_id,
      kind_detail: "mcp.read.run",
      data: { policy_digest: policy.digest as string },
      occurred_at: timestamp,
    });
    const evAttempt = makeEvidenceRecord({
      evidence_id: nextEvidenceId(),
      stage: "attempt",
      task_id: request.task_id,
      run_id: request.run_id,
      attempt_id: request.attempt_id,
      parent_evidence_id: evRun.evidence_id,
      kind_detail: "mcp.read.attempt",
      data: { receipt_id: minted.receipt.receipt_id },
      occurred_at: timestamp,
    });

    const raw = await deps.provider.getRunSnapshot(scope);
    const snapshot: SanitizedRunSnapshot | null =
      raw === null ? null : sanitizeSnapshot(raw, scope);
    const found = snapshot !== null;

    const evAction = makeEvidenceRecord({
      evidence_id: nextEvidenceId(),
      stage: "action",
      task_id: request.task_id,
      run_id: request.run_id,
      attempt_id: request.attempt_id,
      subject_id: request.action_id as string,
      parent_evidence_id: evAttempt.evidence_id,
      kind_detail: "gateway.settled",
      data: { receipt_id: execution.settlement.receipt_id, decision: "ALLOW" },
      occurred_at: now(),
    });
    const evOutcome = makeEvidenceRecord({
      evidence_id: nextEvidenceId(),
      stage: "outcome",
      task_id: request.task_id,
      run_id: request.run_id,
      attempt_id: request.attempt_id,
      subject_id: request.action_id as string,
      parent_evidence_id: evAction.evidence_id,
      kind_detail: found ? "snapshot.read" : "snapshot.not_found",
      data:
        snapshot !== null
          ? { status: snapshot.status, redactions: [...snapshot.redactions] }
          : { status: "not_found" },
      occurred_at: now(),
    });
    const evidence: readonly EvidenceRecord[] = [
      evTask,
      evRun,
      evAttempt,
      evAction,
      evOutcome,
    ];

    return rpcResult(id, {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(found ? snapshot : { found: false }),
        },
      ],
      structuredContent: found ? snapshot : { found: false },
      _meta: {
        motor_decision: "ALLOW",
        evidence_ids: evidence.map((record) => record.evidence_id as string),
        evidence_head_digest: evOutcome.digest as string,
      },
    });
  }

  return async function handleMessage(message: unknown): Promise<unknown | null> {
    if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return rpcError(null, -32600, "invalid JSON-RPC 2.0 request", {
        motor_decision: "DENY",
        reason: "invalid_request",
      });
    }
    const request = message as unknown as JsonRpcRequest;
    const id: JsonRpcId =
      typeof request.id === "string" || typeof request.id === "number" || request.id === null
        ? request.id
        : null;
    const isNotification = request.id === undefined;

    switch (request.method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        });
      case "tools/list":
        return rpcResult(id, { tools: [TOOL_DESCRIPTOR] });
      case "tools/call":
        return callReadSnapshot(id, request.params);
      default:
        if (isNotification || request.method.startsWith("notifications/")) {
          return null;
        }
        return rpcError(id, -32601, "method not found", {
          motor_decision: "DENY",
          reason: "unknown_method",
        });
    }
  };
}
