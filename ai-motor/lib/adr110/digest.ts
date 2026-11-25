/**
 * Pure hashing/serialization utilities for the ADR-110 proof.
 * node:crypto SHA-256 only — pure CPU, no I/O, no side effects.
 */

import { createHash } from "node:crypto";
import type { Sha256Digest } from "./types.ts";
import { branded } from "./types.ts";

/**
 * Canonical JSON: object keys sorted recursively, array order preserved.
 * Throws on values JSON cannot represent deterministically.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null) return null;
  const t = typeof value;
  if (t === "boolean" || t === "string") return value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error("canonicalJson: non-finite number");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  if (t === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const v = source[key];
      if (v === undefined) continue;
      if (typeof v === "function" || typeof v === "symbol") {
        throw new Error(`canonicalJson: unsupported value at key ${key}`);
      }
      out[key] = sortValue(v);
    }
    return out;
  }
  throw new Error(`canonicalJson: unsupported type ${t}`);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Digest of any canonicalizable value, formatted as "sha256:<hex>". */
export function digestOf(value: unknown): Sha256Digest {
  return branded<Sha256Digest>(`sha256:${sha256Hex(canonicalJson(value))}`);
}

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && DIGEST_RE.test(value);
}

/** Deep freeze for immutable contract objects (manifests, receipts, fixtures). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
