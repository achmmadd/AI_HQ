/**
 * ADR-110 engine/Kernel separation.
 *
 * The engine owns Run/Attempt state. The Kernel only projects Task state
 * from idempotent engine events (ADR-104). There is no double Run truth:
 * KernelProjection structurally contains no run records and this module
 * exports no Kernel-side run mutation API.
 *
 * Both reducers are pure: same input → new immutable state; applying the
 * same event_id twice returns the identical state reference.
 */

import { ADR110_SCHEMA_VERSION } from "./types.ts";
import type {
  Attempt,
  AttemptId,
  EmployeeId,
  EventId,
  IsoTimestamp,
  Run,
  RunId,
  TaskId,
  TaskStatus,
  WorkspaceId,
} from "./types.ts";

export type EngineEventType =
  | "run.started"
  | "attempt.started"
  | "attempt.succeeded"
  | "attempt.failed"
  | "run.completed"
  | "run.failed"
  | "task.cancelled";

export interface EngineEvent {
  readonly schema_version: typeof ADR110_SCHEMA_VERSION;
  readonly event_id: EventId;
  /** Monotonic engine sequence number. */
  readonly seq: number;
  readonly workspace_id: WorkspaceId;
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id?: AttemptId;
  readonly type: EngineEventType;
  readonly occurred_at: IsoTimestamp;
  readonly payload?: unknown;
}

// ---------------------------------------------------------------------------
// Engine side — owns Run/Attempt state.
// ---------------------------------------------------------------------------

export interface EngineState {
  readonly runs: Readonly<Record<string, Run>>;
  readonly attempts: Readonly<Record<string, Attempt>>;
  /** Set of applied event ids (idempotency). */
  readonly applied: Readonly<Record<string, true>>;
}

export function initialEngineState(): EngineState {
  return { runs: {}, attempts: {}, applied: {} };
}

export function applyEngineEventToEngine(
  state: EngineState,
  event: EngineEvent,
): EngineState {
  if (state.applied[event.event_id as string] === true) {
    return state;
  }
  const applied = { ...state.applied, [event.event_id as string]: true as const };
  const runs = { ...state.runs };
  const attempts = { ...state.attempts };

  switch (event.type) {
    case "run.started": {
      runs[event.run_id as string] = {
        schema_version: ADR110_SCHEMA_VERSION,
        run_id: event.run_id,
        task_id: event.task_id,
        workspace_id: event.workspace_id,
        status: "running",
        started_at: event.occurred_at,
      };
      break;
    }
    case "attempt.started": {
      if (event.attempt_id === undefined) return state;
      const existing = runs[event.run_id as string];
      if (existing === undefined) return state;
      const index = Object.keys(attempts).filter(
        (key) => attempts[key].run_id === event.run_id,
      ).length;
      attempts[event.attempt_id as string] = {
        schema_version: ADR110_SCHEMA_VERSION,
        attempt_id: event.attempt_id,
        run_id: event.run_id,
        task_id: event.task_id,
        workspace_id: event.workspace_id,
        index,
        status: "running",
        started_at: event.occurred_at,
      };
      break;
    }
    case "attempt.succeeded":
    case "attempt.failed": {
      if (event.attempt_id === undefined) return state;
      const attempt = attempts[event.attempt_id as string];
      if (attempt === undefined) return state;
      attempts[event.attempt_id as string] = {
        ...attempt,
        status: event.type === "attempt.succeeded" ? "succeeded" : "failed",
        ended_at: event.occurred_at,
      };
      break;
    }
    case "run.completed":
    case "run.failed": {
      const run = runs[event.run_id as string];
      if (run === undefined) return state;
      runs[event.run_id as string] = {
        ...run,
        status: event.type === "run.completed" ? "completed" : "failed",
        completed_at: event.occurred_at,
      };
      break;
    }
    case "task.cancelled":
      break;
  }
  return { runs, attempts, applied };
}

// ---------------------------------------------------------------------------
// Kernel side — Task projection only. No Run/Attempt state, no run API.
// ---------------------------------------------------------------------------

export interface TaskProjection {
  readonly task_id: TaskId;
  readonly workspace_id: WorkspaceId;
  readonly status: TaskStatus;
  readonly last_event_id: EventId;
  readonly last_seq: number;
  readonly applied_events: number;
  readonly updated_at: IsoTimestamp;
}

export interface KernelProjection {
  readonly tasks: Readonly<Record<string, TaskProjection>>;
  /** Set of applied event ids (idempotency). */
  readonly applied: Readonly<Record<string, true>>;
}

export function initialKernelProjection(): KernelProjection {
  return { tasks: {}, applied: {} };
}

/** Terminal task statuses never regress. */
const STATUS_RANK: Readonly<Record<TaskStatus, number>> = {
  assigned: 0,
  in_progress: 1,
  completed: 2,
  failed: 2,
  cancelled: 2,
};

const EVENT_STATUS: Readonly<Record<EngineEventType, TaskStatus>> = {
  "run.started": "in_progress",
  "attempt.started": "in_progress",
  "attempt.succeeded": "in_progress",
  "attempt.failed": "in_progress",
  "run.completed": "completed",
  "run.failed": "failed",
  "task.cancelled": "cancelled",
};

export interface TaskSeed {
  readonly task_id: TaskId;
  readonly workspace_id: WorkspaceId;
  readonly employee_id: EmployeeId;
  readonly created_at: IsoTimestamp;
}

/**
 * Applies one engine event to the Kernel task projection.
 * Idempotent on event_id: re-applying a known event returns the identical
 * state reference, so duplicate engine events never double-apply.
 */
export function applyEngineEvent(
  projection: KernelProjection,
  event: EngineEvent,
): KernelProjection {
  if (projection.applied[event.event_id as string] === true) {
    return projection;
  }
  const applied = {
    ...projection.applied,
    [event.event_id as string]: true as const,
  };
  const tasks = { ...projection.tasks };
  const key = event.task_id as string;
  const existing = tasks[key];
  const nextStatus = EVENT_STATUS[event.type];

  if (existing === undefined) {
    tasks[key] = {
      task_id: event.task_id,
      workspace_id: event.workspace_id,
      status: nextStatus,
      last_event_id: event.event_id,
      last_seq: event.seq,
      applied_events: 1,
      updated_at: event.occurred_at,
    };
  } else {
    const regresses =
      STATUS_RANK[nextStatus] < STATUS_RANK[existing.status];
    tasks[key] = {
      ...existing,
      status: regresses ? existing.status : nextStatus,
      last_event_id: event.event_id,
      last_seq: Math.max(existing.last_seq, event.seq),
      applied_events: existing.applied_events + 1,
      updated_at: event.occurred_at,
    };
  }
  return { tasks, applied };
}
