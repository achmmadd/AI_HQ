/**
 * ADR-110 Context Contract: ContextItem validation and ContextManifest
 * build/validate/bind. Pure functions; every `now` is injected.
 *
 * Invariants enforced here:
 * - every ContextItem carries provenance, data_class, scope and a digest that
 *   recomputes over its canonical payload;
 * - cross-workspace items are rejected (item scope workspace must equal the
 *   task workspace);
 * - scope references must point at the task/run/attempt being bound;
 * - expired items are rejected;
 * - a manifest's total digest is recomputed over the ordered item digests —
 *   tampering with an item or the order fails validation;
 * - exactly one manifest per Attempt (bindManifest).
 */

import {
  compareIso,
  isIsoTimestamp,
  ADR110_SCHEMA_VERSION,
  CONTEXT_KINDS,
  DATA_CLASSES,
} from "./types.ts";
import type {
  AttemptId,
  ContextItem,
  ContextKind,
  ContextManifest,
  ContextScope,
  DataClass,
  IsoTimestamp,
  PolicyRef,
  RunId,
  SelectionDecision,
  Task,
} from "./types.ts";
import { deepFreeze, digestOf, isSha256Digest } from "./digest.ts";

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

const ok: ValidationResult = { ok: true };
const fail = (errors: string[]): ValidationResult => ({ ok: false, errors });

/** Digest of a ContextItem is defined over its canonical payload. */
export function computeItemDigest(item: Pick<ContextItem, "payload">) {
  return digestOf(item.payload);
}

export function validateContextItem(item: ContextItem): ValidationResult {
  const errors: string[] = [];
  if (item.schema_version !== ADR110_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${ADR110_SCHEMA_VERSION}`);
  }
  if (!CONTEXT_KINDS.includes(item.kind as ContextKind)) {
    errors.push(`unknown kind: ${String(item.kind)}`);
  }
  if (!DATA_CLASSES.includes(item.data_class as DataClass)) {
    errors.push(`unknown data_class: ${String(item.data_class)}`);
  }
  if (
    !item.provenance ||
    typeof item.provenance.produced_by !== "string" ||
    item.provenance.produced_by.length === 0 ||
    typeof item.provenance.source !== "string" ||
    item.provenance.source.length === 0
  ) {
    errors.push("provenance.produced_by and provenance.source are required");
  }
  errors.push(...validateScope(item.scope));
  if (!isSha256Digest(item.digest)) {
    errors.push("digest is not a well-formed sha256 digest");
  } else if (item.digest !== computeItemDigest(item)) {
    errors.push("digest does not recompute over canonical payload");
  }
  if (!isIsoTimestamp(item.created_at)) {
    errors.push("created_at must be an ISO-8601 timestamp");
  }
  if (item.expires_at !== undefined && !isIsoTimestamp(item.expires_at)) {
    errors.push("expires_at must be an ISO-8601 timestamp");
  }
  if (
    item.expires_at !== undefined &&
    isIsoTimestamp(item.created_at) &&
    compareIso(item.expires_at, item.created_at) <= 0
  ) {
    errors.push("expires_at must be after created_at");
  }
  return errors.length === 0 ? ok : fail(errors);
}

function validateScope(scope: ContextScope): string[] {
  const errors: string[] = [];
  if (!scope || typeof scope !== "object") return ["scope is required"];
  if (typeof scope.workspace_id !== "string" || scope.workspace_id.length === 0) {
    errors.push("scope.workspace_id is required");
  }
  switch (scope.type) {
    case "workspace":
      break;
    case "employee":
      if (!scope.employee_id) errors.push("scope.employee_id is required");
      break;
    case "task":
      if (!scope.task_id) errors.push("scope.task_id is required");
      break;
    case "run":
      if (!scope.run_id) errors.push("scope.run_id is required");
      break;
    case "attempt":
      if (!scope.attempt_id) errors.push("scope.attempt_id is required");
      break;
    default:
      errors.push(`unknown scope type: ${String((scope as { type: unknown }).type)}`);
  }
  return errors;
}

export interface BuildManifestInput {
  readonly task: Task;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
  /** Ordered items; order is significant for the total digest. */
  readonly items: readonly ContextItem[];
  readonly policy: PolicyRef;
  /** Items excluded by selection/redaction, with reason. */
  readonly redacted?: SelectionDecision["redacted"];
  readonly now: IsoTimestamp;
}

export type BuildManifestResult =
  | { readonly ok: true; readonly manifest: ContextManifest }
  | { readonly ok: false; readonly errors: readonly string[] };

export function buildContextManifest(
  input: BuildManifestInput,
): BuildManifestResult {
  const errors: string[] = [];
  const { task, now } = input;

  for (const item of input.items) {
    const itemCheck = validateContextItem(item);
    if (!itemCheck.ok) {
      errors.push(
        `item ${String(item.item_id)}: ${itemCheck.errors.join("; ")}`,
      );
      continue;
    }
    if (item.scope.workspace_id !== task.workspace_id) {
      errors.push(
        `item ${String(item.item_id)}: cross-workspace context rejected ` +
          `(item workspace ${String(item.scope.workspace_id)} != task workspace ${String(task.workspace_id)})`,
      );
    }
    errors.push(...validateScopeBinding(item, input));
    if (item.expires_at !== undefined && compareIso(item.expires_at, now) <= 0) {
      errors.push(`item ${String(item.item_id)}: expired`);
    }
  }

  const redacted = input.redacted ?? [];
  const itemIds = new Set(input.items.map((i) => i.item_id as string));
  for (const r of redacted) {
    if (itemIds.has(r.item_id as string)) {
      errors.push(
        `redacted item ${String(r.item_id)} must not appear in manifest items`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const refs = input.items.map((item) => ({
    item_id: item.item_id,
    digest: item.digest,
  }));
  const total_digest = digestOf(refs.map((r) => r.digest));
  const expiries = input.items
    .map((i) => i.expires_at)
    .filter((e): e is IsoTimestamp => e !== undefined)
    .sort(compareIso);

  const manifest: ContextManifest = {
    schema_version: ADR110_SCHEMA_VERSION,
    task_id: task.task_id,
    run_id: input.run_id,
    attempt_id: input.attempt_id,
    items: refs,
    total_digest,
    policy: input.policy,
    selection: {
      selected: refs.map((r) => r.item_id),
      redacted,
    },
    created_at: now,
    expires_at: expiries.length > 0 ? expiries[0] : undefined,
  };
  return { ok: true, manifest: deepFreeze(manifest) };
}

/** Scope references must point at the task/run/attempt being bound. */
function validateScopeBinding(
  item: ContextItem,
  input: BuildManifestInput,
): string[] {
  const scope = item.scope;
  switch (scope.type) {
    case "workspace":
      return [];
    case "employee":
      return scope.employee_id === input.task.employee_id
        ? []
        : [`item ${String(item.item_id)}: employee scope does not match task assignee`];
    case "task":
      return scope.task_id === input.task.task_id
        ? []
        : [`item ${String(item.item_id)}: task scope does not match bound task`];
    case "run":
      return scope.run_id === input.run_id
        ? []
        : [`item ${String(item.item_id)}: run scope does not match bound run`];
    case "attempt":
      return scope.attempt_id === input.attempt_id
        ? []
        : [`item ${String(item.item_id)}: attempt scope does not match bound attempt`];
  }
}

/**
 * Revalidates a manifest: total digest recomputed over the ordered item
 * digests must match, policy digest must be well-formed, manifest must not
 * be expired at `now`.
 */
export function validateManifest(
  manifest: ContextManifest,
  now: IsoTimestamp,
): ValidationResult {
  const errors: string[] = [];
  if (manifest.schema_version !== ADR110_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${ADR110_SCHEMA_VERSION}`);
  }
  for (const ref of manifest.items) {
    if (!isSha256Digest(ref.digest)) {
      errors.push(`item ${String(ref.item_id)}: malformed digest`);
    }
  }
  if (!isSha256Digest(manifest.policy.digest)) {
    errors.push("policy digest is not a well-formed sha256 digest");
  }
  const recomputed = digestOf(manifest.items.map((r) => r.digest));
  if (recomputed !== manifest.total_digest) {
    errors.push("total digest mismatch: items or order were tampered with");
  }
  if (
    manifest.expires_at !== undefined &&
    compareIso(manifest.expires_at, now) <= 0
  ) {
    errors.push("manifest expired");
  }
  return errors.length === 0 ? ok : fail(errors);
}

export type BindManifestResult =
  | { readonly ok: true; readonly bound: ReadonlyMap<AttemptId, ContextManifest> }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Binds exactly one manifest per Attempt. A second bind for the same
 * attempt — even an identical manifest — is rejected.
 */
export function bindManifest(
  bound: ReadonlyMap<AttemptId, ContextManifest>,
  manifest: ContextManifest,
): BindManifestResult {
  if (bound.has(manifest.attempt_id)) {
    return {
      ok: false,
      errors: [
        `attempt ${String(manifest.attempt_id)} already has a ContextManifest`,
      ],
    };
  }
  const next = new Map(bound);
  next.set(manifest.attempt_id, manifest);
  return { ok: true, bound: next };
}

/**
 * Semantic equality across adapter swaps: everything except the per-run
 * binding fields (run_id, attempt_id, created_at, expires_at) must match.
 */
export function manifestSemanticsEqual(
  a: ContextManifest,
  b: ContextManifest,
): boolean {
  return (
    a.task_id === b.task_id &&
    a.total_digest === b.total_digest &&
    a.policy.policy_id === b.policy.policy_id &&
    a.policy.version === b.policy.version &&
    a.policy.digest === b.policy.digest &&
    a.items.length === b.items.length &&
    a.items.every(
      (ref, i) =>
        ref.item_id === b.items[i].item_id && ref.digest === b.items[i].digest,
    ) &&
    a.selection.redacted.length === b.selection.redacted.length
  );
}
