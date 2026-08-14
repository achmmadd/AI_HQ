/**
 * settlement.ts — ondertekening en verificatie van gateway-settlements
 * voor de pilot-store (koppeling 1: draft.store; koppeling 2: draft.decision).
 *
 * v2 (integratiesprint, spoor A): één gecanonicaliseerde, versiegebonden
 * HMAC-payload die álle velden dekt die de store vertrouwt:
 * - receipt-ID + unieke nonce (randomUUID per ondertekening);
 * - capability/tool en action-ID;
 * - exacte argumenthash én exacte recordhash;
 * - workspace, task, run en attempt;
 * - policy-ID/versie/digest;
 * - issued_at (receipt-mint), executed_at en expires_at.
 *
 * Een onbekende versie, een ontbrekend/extra veld, typecoercion, een
 * gewijzigde payload of record, een verlopen bewijs of een verkeerde sleutel
 * levert altijd DENY. Het runtime-secret wordt fail-closed gevalideerd:
 * exact 64 lowercase hex-karakters (32 bytes, `openssl rand -hex 32`).
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const SETTLEMENT_TTL_MS = 60_000;
export const SETTLEMENT_VERSION = "v2";

/** Fail-closed secret-eis: 32 willekeurige bytes, lowercase hex-geëncodeerd. */
export function isValidStoreSecret(secret: string): boolean {
  return /^[0-9a-f]{64}$/.test(secret);
}

/**
 * Alle velden die onder de handtekening vallen. De gateway-settlement levert
 * receipt_id/action_id/argument_hash/executed_at; de overige causale binding
 * komt van het gemintte receipt en de actieve policy.
 */
export interface SettlementBase {
  readonly receipt_id: string;
  readonly action_id: string;
  readonly argument_hash: string;
  readonly executed_at: string;
  readonly capability: string;
  readonly tool: string;
  readonly workspace_id: string;
  readonly task_id: string;
  readonly run_id: string;
  readonly attempt_id: string;
  readonly policy_id: string;
  readonly policy_version: string;
  readonly policy_digest: string;
  readonly issued_at: string;
}

export interface SignedSettlement extends SettlementBase {
  readonly v: typeof SETTLEMENT_VERSION;
  readonly nonce: string;
  readonly expires_at: string;
  readonly record_sha256: string;
  readonly signature: string;
}

export type SettlementVerification =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "unsupported_version"
        | "record_mismatch"
        | "settlement_expired"
        | "bad_signature";
    };

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function recordDigest(record: unknown): string {
  return createHash("sha256").update(JSON.stringify(record), "utf8").digest("hex");
}

/** Vaste veldvolgorde = canonieke vorm; geen JSON-ambiguïteit. */
function payloadOf(s: Omit<SignedSettlement, "signature">): string {
  return [
    s.v,
    s.receipt_id,
    s.nonce,
    s.capability,
    s.tool,
    s.action_id,
    s.workspace_id,
    s.task_id,
    s.run_id,
    s.attempt_id,
    s.policy_id,
    s.policy_version,
    s.policy_digest,
    s.argument_hash,
    s.record_sha256,
    s.issued_at,
    s.executed_at,
    s.expires_at,
  ].join("\n");
}

export function signSettlement(
  secret: string,
  base: SettlementBase,
  record: unknown,
  now: number = Date.now(),
): SignedSettlement {
  const unsigned: Omit<SignedSettlement, "signature"> = {
    v: SETTLEMENT_VERSION,
    ...base,
    nonce: randomUUID(),
    expires_at: new Date(now + SETTLEMENT_TTL_MS).toISOString(),
    record_sha256: recordDigest(record),
  };
  return { ...unsigned, signature: hmac(secret, payloadOf(unsigned)) };
}

export function verifySettlement(
  secret: string,
  proof: SignedSettlement,
  record: unknown,
  now: number = Date.now(),
): SettlementVerification {
  if (proof.v !== SETTLEMENT_VERSION) {
    return { ok: false, reason: "unsupported_version" };
  }
  if (typeof proof.nonce !== "string" || proof.nonce.length === 0) {
    return { ok: false, reason: "bad_signature" };
  }
  if (proof.record_sha256 !== recordDigest(record)) {
    return { ok: false, reason: "record_mismatch" };
  }
  if (!Number.isFinite(Date.parse(proof.expires_at)) || Date.parse(proof.expires_at) <= now) {
    return { ok: false, reason: "settlement_expired" };
  }
  const expected = hmac(secret, payloadOf(proof));
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(proof.signature), "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
