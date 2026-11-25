/**
 * settlement.ts — authentieke schrijfbewijzen voor de draft.store-koppeling.
 *
 * NIEUW GEBOUWD (geen hergebruik, geen legacy-import). Maakt een
 * gateway-settlement geschikt als transportbewijs naar de store-service:
 *
 * - ondertekend:  HMAC-SHA256 met een gedeeld runtime-secret (env, nooit in
 *   de repo) — een lokaal proces kan geen geldige handtekening verzinnen;
 * - payload-gebonden: de handtekening dekt sha256 van de exacte record-JSON —
 *   record wijzigen = handtekening ongeldig;
 * - tijdelijk:    expires_at (default 60 s) — een oud bewijs vervalt;
 * - eenmalig:     de store-service markeert gebruikte receipt_id's persistent
 *   en weigert elke herhaling (replay).
 *
 * Het bewijs bevat bewust géén bedrijfsinhoud: alleen id's, hashes en tijden.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SETTLEMENT_TTL_MS = 60_000;

/** De gateway-settlement zoals executeAction die oplevert. */
export interface SettlementBase {
  readonly receipt_id: string;
  readonly action_id: string;
  readonly argument_hash: string;
  readonly executed_at: string;
}

/** SettlementBase + transportbeveiliging voor de store-service. */
export interface SignedSettlement extends SettlementBase {
  readonly expires_at: string;
  readonly record_sha256: string;
  readonly signature: string;
}

export type SettlementVerification =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "record_mismatch"
        | "settlement_expired"
        | "bad_signature";
    };

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function recordDigest(record: unknown): string {
  // De store verifiëert over de exacte record-JSON zoals ontvangen; beide
  // kanten serialiseren hetzelfde object met dezelfde veldvolgorde.
  return createHash("sha256").update(JSON.stringify(record), "utf8").digest("hex");
}

function payloadOf(s: Omit<SignedSettlement, "signature">): string {
  return [
    "v1",
    s.receipt_id,
    s.action_id,
    s.argument_hash,
    s.record_sha256,
    s.expires_at,
  ].join("\n");
}

export function signSettlement(
  secret: string,
  base: SettlementBase,
  record: unknown,
  now: number = Date.now(),
): SignedSettlement {
  const unsigned = {
    ...base,
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
