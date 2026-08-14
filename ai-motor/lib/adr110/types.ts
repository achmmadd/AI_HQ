/**
 * ADR-110 — thin semantic kernel: contract types.
 *
 * Pure types, branded ids and small constructors only. No I/O, no stores,
 * no clocks (every `now` is injected), no side effects.
 *
 * Entity separation (ADR-110): Identity / Employee / Task / Context / Policy /
 * Action / Evidence / Evaluation are the eight semantic primitives.
 * Run / Attempt / Agent / Runtime / Model are execution bindings and are kept
 * strictly separate from the core entities.
 */

export const ADR110_SCHEMA_VERSION = "adr110/1";

export type Brand<Base, Name extends string> = Base & {
  readonly __brand: Name;
};

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type TenantId = Brand<string, "TenantId">;
export type IdentityId = Brand<string, "IdentityId">;
export type EmployeeId = Brand<string, "EmployeeId">;
export type TaskId = Brand<string, "TaskId">;
export type RunId = Brand<string, "RunId">;
export type AttemptId = Brand<string, "AttemptId">;
export type AgentId = Brand<string, "AgentId">;
export type ContextItemId = Brand<string, "ContextItemId">;
export type PolicyId = Brand<string, "PolicyId">;
export type ActionId = Brand<string, "ActionId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type EventId = Brand<string, "EventId">;

/** Canonical digest format: "sha256:" followed by 64 lowercase hex chars. */
export type Sha256Digest = Brand<string, "Sha256Digest">;

/** ISO-8601 timestamp string. Always injected; this module never reads a clock. */
export type IsoTimestamp = Brand<string, "IsoTimestamp">;

export function branded<T extends Brand<string, string>>(raw: string): T {
  return raw as T;
}

export function isoTimestamp(raw: string): IsoTimestamp {
  if (!isIsoTimestamp(raw)) {
    throw new Error(`not an ISO-8601 timestamp: ${raw}`);
  }
  return raw as IsoTimestamp;
}

export function isIsoTimestamp(value: unknown): value is IsoTimestamp {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

/** Milliseconds comparison of two ISO timestamps; safe for ordering/expiry. */
export function compareIso(a: IsoTimestamp, b: IsoTimestamp): number {
  return Date.parse(a) - Date.parse(b);
}

// ---------------------------------------------------------------------------
// Primitive 1 — Identity: authenticated human/service principal + scopes.
// ---------------------------------------------------------------------------

export interface Identity {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly identity_id: IdentityId;
  readonly kind: "human" | "service";
  readonly display_name: string;
  readonly workspace_id: WorkspaceId;
  readonly tenant_id: TenantId;
}

// ---------------------------------------------------------------------------
// Primitive 2 — Employee: durable organizational actor.
// Never an alias for a model, runtime or machine: this type has no
// model/runtime/machine fields by design.
// ---------------------------------------------------------------------------

export interface Employee {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly employee_id: EmployeeId;
  readonly workspace_id: WorkspaceId;
  readonly role: string;
  readonly mandate: readonly string[];
  readonly owner_identity_id: IdentityId;
}

// ---------------------------------------------------------------------------
// Primitive 3 — Task: work assigned to an Employee; Kernel projection of
// engine events. The Task itself holds no Run/Attempt state.
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly task_id: TaskId;
  readonly workspace_id: WorkspaceId;
  readonly employee_id: EmployeeId;
  readonly title: string;
  readonly status: TaskStatus;
  readonly created_at: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// Primitive 4 — Context: ContextItem + ContextManifest (typed, digested).
// ---------------------------------------------------------------------------

export const CONTEXT_KINDS = Object.freeze([
  "task",
  "plan",
  "finding",
  "evidence",
  "decision",
  "blocker",
  "question",
  "artifact",
  "handoff",
] as const);
export type ContextKind = (typeof CONTEXT_KINDS)[number];

export const DATA_CLASSES = Object.freeze([
  "public",
  "internal",
  "confidential",
  "restricted",
] as const);
export type DataClass = (typeof DATA_CLASSES)[number];

/** Every scope variant carries workspace_id so cross-workspace checks are uniform. */
export type ContextScope =
  | { readonly type: "workspace"; readonly workspace_id: WorkspaceId }
  | {
      readonly type: "employee";
      readonly workspace_id: WorkspaceId;
      readonly employee_id: EmployeeId;
    }
  | {
      readonly type: "task";
      readonly workspace_id: WorkspaceId;
      readonly task_id: TaskId;
    }
  | {
      readonly type: "run";
      readonly workspace_id: WorkspaceId;
      readonly run_id: RunId;
    }
  | {
      readonly type: "attempt";
      readonly workspace_id: WorkspaceId;
      readonly attempt_id: AttemptId;
    };

export interface ContextProvenance {
  readonly produced_by: string;
  readonly source: string;
}

export interface ContextItem {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly item_id: ContextItemId;
  readonly kind: ContextKind;
  readonly provenance: ContextProvenance;
  readonly data_class: DataClass;
  readonly scope: ContextScope;
  /** sha256 digest over the canonical payload; tampering with payload breaks it. */
  readonly digest: Sha256Digest;
  readonly payload: unknown;
  readonly created_at: IsoTimestamp;
  readonly expires_at?: IsoTimestamp;
}

export interface ManifestItemRef {
  readonly item_id: ContextItemId;
  readonly digest: Sha256Digest;
}

export interface PolicyRef {
  readonly policy_id: PolicyId;
  readonly version: string;
  readonly digest: Sha256Digest;
}

export interface SelectionDecision {
  readonly selected: readonly ContextItemId[];
  readonly redacted: readonly {
    readonly item_id: ContextItemId;
    readonly reason: string;
  }[];
}

/** Immutable per Attempt; exactly one per Attempt (enforced by bindManifest). */
export interface ContextManifest {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
  readonly items: readonly ManifestItemRef[];
  readonly total_digest: Sha256Digest;
  readonly policy: PolicyRef;
  readonly selection: SelectionDecision;
  readonly created_at: IsoTimestamp;
  readonly expires_at?: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// Primitive 5 — Policy: versioned rules + digest. Evaluated by the Gateway.
// ---------------------------------------------------------------------------

export type RiskClass = "R0" | "R1" | "R2";

export interface CapabilityPolicy {
  readonly risk: RiskClass;
  readonly requires_approval: boolean;
  readonly budget_cents_max: number;
  readonly allowed_data_classes: readonly DataClass[];
  readonly network: "none" | "egress";
}

export interface Policy {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly policy_id: PolicyId;
  readonly version: string;
  readonly workspace_id: WorkspaceId;
  readonly capabilities: Readonly<Record<string, CapabilityPolicy>>;
  /** Digest over the canonical policy content (excluding this field). */
  readonly digest: Sha256Digest;
}

// ---------------------------------------------------------------------------
// Primitive 6 — Action: requested business side effect. Only executable via
// a Gateway decision + receipt (see gateway.ts).
// ---------------------------------------------------------------------------

export interface ActionRequest {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly action_id: ActionId;
  readonly workspace_id: WorkspaceId;
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
  readonly capability: string;
  readonly tool: string;
  readonly args: unknown;
  readonly data_class: DataClass;
  readonly estimated_cost_cents: number;
  readonly requested_by: EmployeeId;
  readonly requested_at: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// Primitive 7 — Evidence: causal chain task → run → attempt →
// action/artifact → outcome. Orphan records are detectable (evidence.ts).
// ---------------------------------------------------------------------------

export type EvidenceStage =
  | "task"
  | "run"
  | "attempt"
  | "action"
  | "artifact"
  | "outcome";

export interface EvidenceRecord {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly evidence_id: EvidenceId;
  readonly stage: EvidenceStage;
  readonly task_id: TaskId;
  readonly run_id?: RunId;
  readonly attempt_id?: AttemptId;
  /** Action/artifact/outcome subject identifier for those stages. */
  readonly subject_id?: string;
  /** Chain link to the previous stage's evidence record. */
  readonly parent_evidence_id?: EvidenceId;
  readonly kind_detail: string;
  readonly data: unknown;
  readonly occurred_at: IsoTimestamp;
  readonly digest: Sha256Digest;
}

// ---------------------------------------------------------------------------
// Primitive 8 — Evaluation: the five active criteria, computed from the
// evidence chain only (evaluation.ts).
// ---------------------------------------------------------------------------

export interface EvaluationCriteria {
  /** (1) successful outcomes / completed tasks, 0..1. */
  readonly task_success_rate: number;
  /** (2) human corrections normalized per 10 completed tasks. */
  readonly human_corrections_per_10_tasks: number;
  /** (3) unauthorized action attempts; must be 0. Recorded as evidence. */
  readonly unauthorized_actions: number;
  /** (7) total cost cents / successful tasks. */
  readonly cost_per_successful_task_cents: number;
  /** (16) mean human outcome-review rating: approved=1, corrected=0.5, rejected=0. */
  readonly operator_trust_score: number;
}

// ---------------------------------------------------------------------------
// Execution bindings — strictly separated from the core entities above.
// Owned by the engine (Run/Attempt state) or bound per Attempt (Agent,
// Runtime, Model); replaceable without changing Employee/Task/Policy.
// ---------------------------------------------------------------------------

export interface Run {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly run_id: RunId;
  readonly task_id: TaskId;
  readonly workspace_id: WorkspaceId;
  readonly status: "running" | "completed" | "failed";
  readonly started_at: IsoTimestamp;
  readonly completed_at?: IsoTimestamp;
}

export interface Attempt {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly attempt_id: AttemptId;
  readonly run_id: RunId;
  readonly task_id: TaskId;
  readonly workspace_id: WorkspaceId;
  readonly index: number;
  readonly status: "running" | "succeeded" | "failed" | "cancelled";
  readonly started_at: IsoTimestamp;
  readonly ended_at?: IsoTimestamp;
}

/** Delegated execution identity/profile within one Attempt. */
export interface Agent {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly agent_id: AgentId;
  readonly attempt_id: AttemptId;
  readonly profile: string;
  readonly delegated_by: EmployeeId;
}

/** Replaceable per-Attempt bindings. */
export interface RuntimeBinding {
  readonly runtime: string;
  readonly harness: string;
}

export interface ModelBinding {
  readonly provider: string;
  readonly model: string;
}
