/**
 * motor.pilot.read_run_snapshot — types, the read-only provider contract and
 * the sanitizer that decides what may cross the MCP boundary.
 *
 * The provider is injected and is read-only BY CONSTRUCTION: the interface
 * exposes exactly one getter and the handler never receives (or can reach)
 * any write surface. The driver may return raw fields (context_text,
 * draft_text); the sanitizer is the single place that decides what leaves
 * the process — ids, digests, statuses and chain metadata only, never raw
 * business content, secrets, hosts or IPs.
 */

import type { EvidenceRecord } from "../../lib/adr110/types.ts";
import { buildEvidenceChain } from "../../lib/adr110/evidence.ts";

export const SNAPSHOT_SCHEMA = "motor.pilot.run_snapshot/v1" as const;

/** Scope of one read: exactly these three causal ids, nothing else. */
export interface RunSnapshotScope {
  readonly workspace_id: string;
  readonly task_id: string;
  readonly run_id: string;
}

/**
 * What the injected driver may return. May contain sensitive raw fields;
 * the sanitizer strips them before anything crosses the boundary.
 */
export interface RawRunSnapshot {
  readonly task_id: string;
  readonly run_id: string;
  readonly status: string;
  readonly attempt_id: string;
  readonly adapter_id: string;
  readonly adapter_version: string;
  readonly artifact_id?: string;
  readonly artifact_digest?: string;
  readonly draft_id?: string;
  readonly draft_digest?: string;
  readonly evidence: readonly EvidenceRecord[];
  readonly evaluation_status: string;
  readonly data_class: "public" | "internal";
  /** Sensitive: never crosses the boundary. */
  readonly context_text?: string;
  /** Sensitive: never crosses the boundary. */
  readonly draft_text?: string;
}

/**
 * What the MCP caller receives: bounded, sanitized, content-free. Evidence
 * appears as chain metadata (count, validity, head digest) — never as raw
 * records, because record data can embed operational detail.
 */
export interface SanitizedRunSnapshot {
  readonly schema_version: typeof SNAPSHOT_SCHEMA;
  readonly workspace_id: string;
  readonly task_id: string;
  readonly run_id: string;
  readonly status: string;
  readonly attempt_id: string;
  readonly adapter: {
    readonly adapter_id: string;
    readonly adapter_version: string;
  };
  readonly artifacts: readonly {
    readonly artifact_id: string;
    readonly digest: string;
  }[];
  readonly draft?: {
    readonly draft_id: string;
    readonly digest: string;
  };
  readonly evidence: {
    readonly record_count: number;
    readonly chain_valid: boolean;
    readonly head_digest: string | null;
  };
  readonly evaluation_status: string;
  readonly data_class: "public" | "internal";
  readonly scope: "run.snapshot.read";
  /** Names of raw fields the sanitizer removed from the driver payload. */
  readonly redactions: readonly string[];
}

/**
 * Read-only by construction: exactly one method, no write surface. The
 * handler asserts at runtime that the injected object carries nothing else.
 */
export interface RunSnapshotProvider {
  readonly getRunSnapshot: (
    scope: RunSnapshotScope,
  ) => Promise<RawRunSnapshot | null>;
}

/** Raw fields that may never leave the process, in stable redaction order. */
const SENSITIVE_RAW_FIELDS = ["context_text", "draft_text"] as const;

export function sanitizeSnapshot(
  raw: RawRunSnapshot,
  scope: RunSnapshotScope,
): SanitizedRunSnapshot {
  const chain = buildEvidenceChain(raw.evidence);
  const head = raw.evidence[raw.evidence.length - 1];
  const artifacts: { artifact_id: string; digest: string }[] = [];
  if (raw.artifact_id !== undefined && raw.artifact_digest !== undefined) {
    artifacts.push({
      artifact_id: raw.artifact_id,
      digest: raw.artifact_digest,
    });
  }
  const redactions = SENSITIVE_RAW_FIELDS.filter(
    (field) => raw[field] !== undefined,
  );
  return Object.freeze({
    schema_version: SNAPSHOT_SCHEMA,
    workspace_id: scope.workspace_id,
    task_id: scope.task_id,
    run_id: scope.run_id,
    status: raw.status,
    attempt_id: raw.attempt_id,
    adapter: Object.freeze({
      adapter_id: raw.adapter_id,
      adapter_version: raw.adapter_version,
    }),
    artifacts: Object.freeze(artifacts),
    draft:
      raw.draft_id !== undefined && raw.draft_digest !== undefined
        ? Object.freeze({ draft_id: raw.draft_id, digest: raw.draft_digest })
        : undefined,
    evidence: Object.freeze({
      record_count: raw.evidence.length,
      chain_valid: chain.ok,
      head_digest: head === undefined ? null : (head.digest as string),
    }),
    evaluation_status: raw.evaluation_status,
    data_class: raw.data_class,
    scope: "run.snapshot.read",
    redactions: Object.freeze(redactions),
  });
}
