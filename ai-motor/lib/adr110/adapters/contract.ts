/**
 * ADR-110 capability-adapter contract.
 *
 * An adapter declares: id + version, capabilities, data-class/network
 * requirements, health/invoke/cancel, a normalized result/error model and
 * echoes the causal ids (task_id, run_id, attempt_id) it was invoked with.
 *
 * An adapter owns nothing: no durable task state, no employee identity, no
 * policy truth, no credentials. health()/invoke()/cancel() may return their
 * result synchronously (the pure fake adapters) or as a Promise (a real I/O
 * adapter; a remote sidecar cancel is demonstrably async — phase-0 seam
 * decision of the integration sprint, 2026-08-14). Simulated latency/cost
 * are metadata only.
 */

import type {
  Agent,
  AttemptId,
  ContextManifest,
  DataClass,
  IsoTimestamp,
  ModelBinding,
  RunId,
  RuntimeBinding,
  TaskId,
} from "../types.ts";

export interface AdapterRequirements {
  readonly data_classes: readonly DataClass[];
  readonly network: "none" | "egress";
}

export interface AdapterHealth {
  readonly adapter_id: string;
  readonly adapter_version: string;
  readonly status: "ok" | "degraded" | "down";
  readonly checked_at: IsoTimestamp;
}

export interface AdapterInvokeRequest {
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
  /** The single ContextManifest bound to this attempt. */
  readonly manifest: ContextManifest;
  readonly agent: Agent;
  readonly runtime: RuntimeBinding;
  readonly model: ModelBinding;
  readonly input: string;
}

export interface AdapterResultMeta {
  readonly adapter_id: string;
  readonly adapter_version: string;
  readonly simulated_latency_ms: number;
  readonly simulated_cost_cents: number;
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
}

export interface AdapterError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
}

export type AdapterResult =
  | { readonly ok: true; readonly output: string; readonly meta: AdapterResultMeta }
  | { readonly ok: false; readonly error: AdapterError };

export interface AdapterCancelResult {
  readonly cancelled: boolean;
  readonly attempt_id: AttemptId;
}

/** The members an adapter exposes — used by tests to prove statelessness. */
export const ADAPTER_CONTRACT_MEMBERS = Object.freeze([
  "adapter_id",
  "adapter_version",
  "capabilities",
  "requirements",
  "health",
  "invoke",
  "cancel",
] as const);

export interface CapabilityAdapter {
  readonly adapter_id: string;
  readonly adapter_version: string;
  readonly capabilities: readonly string[];
  readonly requirements: AdapterRequirements;
  health(now: IsoTimestamp): AdapterHealth | Promise<AdapterHealth>;
  invoke(request: AdapterInvokeRequest): AdapterResult | Promise<AdapterResult>;
  cancel(
    attempt_id: AttemptId,
    now: IsoTimestamp,
  ): AdapterCancelResult | Promise<AdapterCancelResult>;
}
