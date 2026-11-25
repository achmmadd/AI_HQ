/**
 * ADR-110 proof scenario: one Employee ("ReviewResponder") and one Task,
 * executed through two fake adapters. Pure fixture builders and a pure
 * orchestration helper shared by the tests. No I/O; all timestamps injected.
 */

import {
  ADR110_SCHEMA_VERSION,
  branded,
  isoTimestamp,
} from "./types.ts";
import type {
  Agent,
  AgentId,
  AttemptId,
  ContextItem,
  ContextManifest,
  Employee,
  Identity,
  IsoTimestamp,
  ModelBinding,
  Policy,
  PolicyId,
  RunId,
  RuntimeBinding,
  Task,
  TaskId,
  WorkspaceId,
} from "./types.ts";
import { deepFreeze, digestOf } from "./digest.ts";
import { buildContextManifest } from "./context.ts";
import type { EngineEvent } from "./engine.ts";
import { makeEvidenceRecord } from "./evidence.ts";
import type { EvidenceRecord } from "./types.ts";
import { computePolicyDigest } from "./gateway.ts";
import type { CapabilityAdapter } from "./adapters/contract.ts";
import type { AdapterResult } from "./adapters/contract.ts";

export const PROOF_WORKSPACE_ID = branded<WorkspaceId>("ws-motor");
export const OTHER_WORKSPACE_ID = branded<WorkspaceId>("ws-other");
export const PROOF_TASK_ID = branded<TaskId>("task-review-42");

export const T0 = isoTimestamp("2026-08-14T00:00:00.000Z");
export const T1 = isoTimestamp("2026-08-14T00:00:01.000Z");
export const T2 = isoTimestamp("2026-08-14T00:00:02.000Z");
export const T3 = isoTimestamp("2026-08-14T00:00:03.000Z");
export const T4 = isoTimestamp("2026-08-14T00:00:04.000Z");
export const T5 = isoTimestamp("2026-08-14T00:00:05.000Z");
export const EXPIRED_AT = isoTimestamp("2026-08-13T23:59:59.000Z");

export interface ProofFixture {
  readonly now: IsoTimestamp;
  readonly identity: Identity;
  readonly employee: Employee;
  readonly task: Task;
  readonly policy: Policy;
  readonly items: readonly ContextItem[];
  readonly cross_workspace_item: ContextItem;
  readonly expired_item: ContextItem;
}

export function makeContextItem(input: {
  readonly item_id: string;
  readonly kind: ContextItem["kind"];
  readonly data_class: ContextItem["data_class"];
  readonly scope: ContextItem["scope"];
  readonly payload: unknown;
  readonly created_at: IsoTimestamp;
  readonly expires_at?: IsoTimestamp;
  readonly produced_by?: string;
  readonly source?: string;
}): ContextItem {
  return deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    item_id: branded(input.item_id),
    kind: input.kind,
    provenance: {
      produced_by: input.produced_by ?? "employee:review-responder",
      source: input.source ?? "proof-fixture",
    },
    data_class: input.data_class,
    scope: input.scope,
    digest: digestOf(input.payload),
    payload: input.payload,
    created_at: input.created_at,
    expires_at: input.expires_at,
  });
}

export function buildProofFixture(): ProofFixture {
  const identity: Identity = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    identity_id: branded("identity-pietje"),
    kind: "human",
    display_name: "Pietje",
    workspace_id: PROOF_WORKSPACE_ID,
    tenant_id: branded("tenant-motor"),
  });

  const employee: Employee = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    employee_id: branded("employee-review-responder"),
    workspace_id: PROOF_WORKSPACE_ID,
    role: "ReviewResponder",
    mandate: ["draft review replies", "never publish without approval"],
    owner_identity_id: identity.identity_id,
  });

  const task: Task = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    task_id: PROOF_TASK_ID,
    workspace_id: PROOF_WORKSPACE_ID,
    employee_id: employee.employee_id,
    title: "Draft a reply to review #42",
    status: "assigned",
    created_at: T0,
  });

  const policyContent = {
    schema_version: ADR110_SCHEMA_VERSION,
    policy_id: branded<PolicyId>("policy-motor-default"),
    version: "1.0.0",
    workspace_id: PROOF_WORKSPACE_ID,
    capabilities: {
      "draft.generate": {
        risk: "R0",
        requires_approval: false,
        budget_cents_max: 100,
        allowed_data_classes: ["public", "internal"],
        network: "none",
      },
      "review.reply.publish": {
        risk: "R2",
        requires_approval: true,
        budget_cents_max: 50,
        allowed_data_classes: ["public", "internal"],
        network: "egress",
      },
    },
  } as const;
  const policy: Policy = deepFreeze({
    ...policyContent,
    digest: computePolicyDigest(policyContent),
  });

  const items = [
    makeContextItem({
      item_id: "ctx-task-42",
      kind: "task",
      data_class: "internal",
      scope: { type: "task", workspace_id: PROOF_WORKSPACE_ID, task_id: task.task_id },
      payload: { title: task.title, review_id: 42, rating: 2 },
      created_at: T0,
    }),
    makeContextItem({
      item_id: "ctx-plan-draft",
      kind: "plan",
      data_class: "internal",
      scope: { type: "workspace", workspace_id: PROOF_WORKSPACE_ID },
      payload: { steps: ["acknowledge", "apologize", "offer remedy"] },
      created_at: T0,
    }),
    makeContextItem({
      item_id: "ctx-finding-tone",
      kind: "finding",
      data_class: "public",
      scope: {
        type: "employee",
        workspace_id: PROOF_WORKSPACE_ID,
        employee_id: employee.employee_id,
      },
      payload: { tone: "friendly-professional" },
      created_at: T0,
    }),
  ];

  const cross_workspace_item = makeContextItem({
    item_id: "ctx-foreign",
    kind: "finding",
    data_class: "internal",
    scope: { type: "workspace", workspace_id: OTHER_WORKSPACE_ID },
    payload: { note: "belongs to another workspace" },
    created_at: T0,
  });

  const expired_item = makeContextItem({
    item_id: "ctx-expired",
    kind: "artifact",
    data_class: "internal",
    scope: { type: "workspace", workspace_id: PROOF_WORKSPACE_ID },
    payload: { stale: true },
    created_at: isoTimestamp("2026-08-13T00:00:00.000Z"),
    expires_at: EXPIRED_AT,
  });

  return deepFreeze({
    now: T1,
    identity,
    employee,
    task,
    policy,
    items,
    cross_workspace_item,
    expired_item,
  });
}

export interface RunIds {
  readonly run_id: string;
  readonly attempt_id: string;
  readonly agent_id: string;
}

/** Deterministic per-run ids, e.g. createRunIds("a") → run-a / att-a / agent-a. */
export function createRunIds(label: string): RunIds {
  return {
    run_id: `run-${label}`,
    attempt_id: `att-${label}`,
    agent_id: `agent-${label}`,
  };
}

export interface RunThroughResult {
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
  readonly agent: Agent;
  readonly runtime: RuntimeBinding;
  readonly model: ModelBinding;
  readonly manifest: ContextManifest;
  readonly result: AdapterResult;
  readonly engine_events: readonly EngineEvent[];
  readonly evidence: readonly EvidenceRecord[];
}

/**
 * Pure orchestration of one Run of the fixture Task through one adapter:
 * binds exactly one ContextManifest to the Attempt, invokes the adapter and
 * returns the engine events and the full causal evidence chain. Async because
 * the contract's invoke() seam allows a Promise-returning adapter.
 */
export async function runTaskThroughAdapter(
  adapter: CapabilityAdapter,
  fixture: ProofFixture,
  ids: { readonly run_id: string; readonly attempt_id: string; readonly agent_id: string },
): Promise<RunThroughResult> {
  const run_id = branded<RunId>(ids.run_id);
  const attempt_id = branded<AttemptId>(ids.attempt_id);
  const agent: Agent = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    agent_id: branded<AgentId>(ids.agent_id),
    attempt_id,
    profile: "review-drafter",
    delegated_by: fixture.employee.employee_id,
  });
  const runtime: RuntimeBinding = deepFreeze({
    runtime: `runtime-via-${adapter.adapter_id}`,
    harness: "proof-harness",
  });
  const model: ModelBinding = deepFreeze({
    provider: adapter.adapter_id,
    model: `simulated-${adapter.adapter_version}`,
  });

  const built = buildContextManifest({
    task: fixture.task,
    run_id,
    attempt_id,
    items: fixture.items,
    policy: {
      policy_id: fixture.policy.policy_id,
      version: fixture.policy.version,
      digest: fixture.policy.digest,
    },
    now: fixture.now,
  });
  if (!built.ok) {
    throw new Error(`fixture manifest must build: ${built.errors.join("; ")}`);
  }
  const manifest = built.manifest;

  const result = await adapter.invoke({
    task_id: fixture.task.task_id,
    run_id,
    attempt_id,
    manifest,
    agent,
    runtime,
    model,
    input: "Draft a friendly reply to review #42",
  });

  const engine_events: readonly EngineEvent[] = [
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${ids.run_id}-run-started`),
      seq: 1,
      workspace_id: PROOF_WORKSPACE_ID,
      task_id: fixture.task.task_id,
      run_id,
      type: "run.started",
      occurred_at: T1,
    },
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${ids.attempt_id}-started`),
      seq: 2,
      workspace_id: PROOF_WORKSPACE_ID,
      task_id: fixture.task.task_id,
      run_id,
      attempt_id,
      type: "attempt.started",
      occurred_at: T2,
    },
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${ids.attempt_id}-succeeded`),
      seq: 3,
      workspace_id: PROOF_WORKSPACE_ID,
      task_id: fixture.task.task_id,
      run_id,
      attempt_id,
      type: "attempt.succeeded",
      occurred_at: T3,
    },
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${ids.run_id}-completed`),
      seq: 4,
      workspace_id: PROOF_WORKSPACE_ID,
      task_id: fixture.task.task_id,
      run_id,
      type: "run.completed",
      occurred_at: T4,
    },
  ];

  if (!result.ok) {
    throw new Error("fixture invocation must succeed");
  }
  const output = result.output;
  const cost = result.meta.simulated_cost_cents;

  const evTask = makeEvidenceRecord({
    evidence_id: branded(`ev-${ids.run_id}-task`),
    stage: "task",
    task_id: fixture.task.task_id,
    subject_id: fixture.task.task_id as string,
    kind_detail: "task.assigned",
    data: { employee_id: fixture.employee.employee_id, title: fixture.task.title },
    occurred_at: T1,
  });
  const evRun = makeEvidenceRecord({
    evidence_id: branded(`ev-${ids.run_id}-run`),
    stage: "run",
    task_id: fixture.task.task_id,
    run_id,
    subject_id: run_id as string,
    parent_evidence_id: evTask.evidence_id,
    kind_detail: "run.started",
    data: { engine: "proof-engine" },
    occurred_at: T1,
  });
  const evAttempt = makeEvidenceRecord({
    evidence_id: branded(`ev-${ids.attempt_id}-attempt`),
    stage: "attempt",
    task_id: fixture.task.task_id,
    run_id,
    attempt_id,
    subject_id: attempt_id as string,
    parent_evidence_id: evRun.evidence_id,
    kind_detail: "context.manifest.bound",
    data: {
      total_digest: manifest.total_digest,
      item_count: manifest.items.length,
      policy_digest: manifest.policy.digest,
      agent_id: agent.agent_id,
      adapter_id: adapter.adapter_id,
    },
    occurred_at: T2,
  });
  const evArtifact = makeEvidenceRecord({
    evidence_id: branded(`ev-${ids.attempt_id}-artifact`),
    stage: "artifact",
    task_id: fixture.task.task_id,
    run_id,
    attempt_id,
    subject_id: `artifact-${ids.attempt_id}`,
    parent_evidence_id: evAttempt.evidence_id,
    kind_detail: "adapter.result",
    data: {
      output,
      cost_cents: cost,
      adapter_id: adapter.adapter_id,
      adapter_version: adapter.adapter_version,
    },
    occurred_at: T3,
  });
  const evOutcome = makeEvidenceRecord({
    evidence_id: branded(`ev-${ids.attempt_id}-outcome`),
    stage: "outcome",
    task_id: fixture.task.task_id,
    run_id,
    attempt_id,
    subject_id: `outcome-${ids.attempt_id}`,
    parent_evidence_id: evArtifact.evidence_id,
    kind_detail: "human.review",
    data: {
      status: "success",
      human_review: {
        rating: "approved",
        corrections: 0,
        reviewed_by: fixture.identity.identity_id,
      },
    },
    occurred_at: T5,
  });

  return deepFreeze({
    run_id,
    attempt_id,
    agent,
    runtime,
    model,
    manifest,
    result,
    engine_events,
    evidence: [evTask, evRun, evAttempt, evArtifact, evOutcome],
  });
}
