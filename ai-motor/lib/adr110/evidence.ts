/**
 * ADR-110 Evidence: causal chain task → run → attempt → action/artifact →
 * outcome. Pure builder + validator + orphan detection.
 *
 * Every record carries a digest over its canonical content (excluding the
 * digest field), a link to its parent record and the causal ids. A record is
 * an orphan when its parent link is missing/unknown or its causal ids are
 * inconsistent with the parent record.
 */

import { ADR110_SCHEMA_VERSION } from "./types.ts";
import type {
  EvidenceRecord,
  EvidenceStage,
  IsoTimestamp,
  Sha256Digest,
} from "./types.ts";
import { digestOf, isSha256Digest } from "./digest.ts";
import type { ValidationResult } from "./context.ts";

/** Allowed predecessor stage for each stage (the causal chain shape). */
const PREDECESSOR: Readonly<Record<EvidenceStage, readonly EvidenceStage[]>> = {
  task: [],
  run: ["task"],
  attempt: ["run"],
  action: ["attempt"],
  artifact: ["attempt"],
  outcome: ["attempt", "action", "artifact"],
};

/** Kind detail marking an unauthorized action attempt (metric 3 counts these). */
export const UNAUTHORIZED_ATTEMPT_KIND = "gateway.unauthorized_attempt";

export function computeEvidenceDigest(
  record: Omit<EvidenceRecord, "digest">,
): Sha256Digest {
  return digestOf(record);
}

export function makeEvidenceRecord(
  input: Omit<EvidenceRecord, "schema_version" | "digest">,
): EvidenceRecord {
  const base: Omit<EvidenceRecord, "digest"> = {
    schema_version: ADR110_SCHEMA_VERSION,
    ...input,
  };
  return Object.freeze({ ...base, digest: digestOf(base) });
}

export interface EvidenceChain {
  readonly records: readonly EvidenceRecord[];
}

export type BuildChainResult =
  | { readonly ok: true; readonly chain: EvidenceChain }
  | { readonly ok: false; readonly errors: readonly string[] };

export function buildEvidenceChain(
  records: readonly EvidenceRecord[],
): BuildChainResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const record of records) {
    if (record.schema_version !== ADR110_SCHEMA_VERSION) {
      errors.push(`${String(record.evidence_id)}: bad schema_version`);
    }
    if (!isSha256Digest(record.digest)) {
      errors.push(`${String(record.evidence_id)}: malformed digest`);
    } else {
      const { digest: _omit, ...rest } = record;
      if (digestOf(rest) !== record.digest) {
        errors.push(`${String(record.evidence_id)}: digest mismatch (tampered)`);
      }
    }
    if (ids.has(record.evidence_id as string)) {
      errors.push(`${String(record.evidence_id)}: duplicate evidence id`);
    }
    ids.add(record.evidence_id as string);
  }
  const orphans = findOrphans(records);
  for (const orphan of orphans) {
    errors.push(`${String(orphan.evidence_id)}: orphan record (stage ${orphan.stage})`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, chain: Object.freeze({ records: Object.freeze([...records]) }) };
}

/**
 * Returns every record whose causal link is broken: missing parent reference,
 * unknown parent id, wrong predecessor stage, or causal ids inconsistent with
 * the parent. Empty on a valid chain.
 */
export function findOrphans(
  records: readonly EvidenceRecord[],
): EvidenceRecord[] {
  const byId = new Map<string, EvidenceRecord>();
  for (const record of records) byId.set(record.evidence_id as string, record);

  const orphans: EvidenceRecord[] = [];
  for (const record of records) {
    if (record.stage === "task") {
      if (record.parent_evidence_id !== undefined) orphans.push(record);
      continue;
    }
    if (record.parent_evidence_id === undefined) {
      orphans.push(record);
      continue;
    }
    const parent = byId.get(record.parent_evidence_id as string);
    if (parent === undefined) {
      orphans.push(record);
      continue;
    }
    if (!PREDECESSOR[record.stage].includes(parent.stage)) {
      orphans.push(record);
      continue;
    }
    if (parent.task_id !== record.task_id) {
      orphans.push(record);
      continue;
    }
    if (
      record.run_id !== undefined &&
      parent.run_id !== undefined &&
      parent.run_id !== record.run_id
    ) {
      orphans.push(record);
      continue;
    }
    if (
      record.attempt_id !== undefined &&
      parent.attempt_id !== undefined &&
      parent.attempt_id !== record.attempt_id
    ) {
      orphans.push(record);
    }
  }
  return orphans;
}

export function isChainValid(
  records: readonly EvidenceRecord[],
  _now?: IsoTimestamp,
): ValidationResult {
  const result = buildEvidenceChain(records);
  return result.ok ? { ok: true } : { ok: false, errors: result.errors };
}
