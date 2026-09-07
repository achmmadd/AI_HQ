/**
 * draft-store.ts — client voor de draft.store-koppeling + read-side.
 *
 * Scheiding volgens de pilot-regels:
 * - SCHRIJVEN gebeurt uitsluitend door de store-service (pilot/store-service.ts),
 *   de action-driver binnen de trust boundary van de gateway. Deze module is
 *   alleen de client die ná een gateway-settlement de schrijfopdracht indient.
 * - LEZEN (listDrafts) gebeurt door de API via een read-only mount van /data;
 *   de API kan fysiek niet schrijven (docker :ro).
 */

import { readFile } from "node:fs/promises";

import type { EvidenceRecord, Sha256Digest } from "../lib/adr110/index.ts";

// Default localhost (de store-service bindt op 127.0.0.1 via host-networking);
// geen interne hostnames in de repo — afwijkende waarde is runtime-env.
export const STORE_URL = process.env.DRAFT_STORE_URL ?? "http://127.0.0.1:4401";
export const DRAFT_STORE_PATH =
  process.env.DRAFT_STORE_PATH ?? "/data/drafts.jsonl";

export interface DraftStoreRecord {
  /** Routering in de store-service; oude records zonder type = "draft". */
  readonly type?: "draft";
  readonly stored_at: string;
  readonly run_id: string;
  readonly receipt_id: string;
  readonly synthetic: boolean;
  readonly review: string;
  readonly draft: string;
}

/**
 * Koppeling 2: menselijke beslissing over een opgeslagen concept.
 * Eén beslissing per concept (first-decision-wins, append-only).
 */
export interface DecisionStoreRecord {
  readonly type: "decision";
  readonly decided_at: string;
  readonly draft_run_id: string;
  readonly decision: "approved" | "rejected";
  readonly note: string | null;
  readonly decided_by: string;
  readonly receipt_id: string;
}

/**
 * Koppeling 3: de gevalideerde evidence-keten van één run, zodat de vijf
 * actieve meetcriteria uit OPGESLAGEN evidence berekend kunnen worden in
 * plaats van alleen in tests. De keten bevat per ontwerp geen bedrijfsinhoud
 * (alleen id's, hashes, omvang en status) — die redaction-regel is bewezen in
 * boundary.test.ts en geldt dus ook voor dit bestand op schijf.
 *
 * De keten beschrijft de run zelf; de opslag van de keten (de evidence.store-
 * actie) maakt bewust géén deel uit van de opgeslagen keten — dat zou
 * recursief zijn. Alleen de receipt_id van die actie staat in dit record.
 */
export interface EvidenceStoreRecord {
  readonly type: "evidence";
  readonly stored_at: string;
  readonly run_id: string;
  readonly receipt_id: string;
  /** digestOf(records) — canonieke inhoudsbinding van de hele keten. */
  readonly chain_digest: Sha256Digest;
  readonly record_count: number;
  readonly records: readonly EvidenceRecord[];
}

export type StoreRecord =
  | DraftStoreRecord
  | DecisionStoreRecord
  | EvidenceStoreRecord;

/**
 * Het ondertekende schrijfbewijs (zie pilot/settlement.ts). Naast de
 * gateway-velden: expires_at (tijdelijk), record_sha256 (payload-binding)
 * en signature (HMAC-SHA256 met het gedeelde runtime-secret).
 */
export interface StoreSettlementProof {
  readonly receipt_id: string;
  readonly action_id: string;
  readonly argument_hash: string;
  readonly executed_at: string;
  readonly expires_at: string;
  readonly record_sha256: string;
  readonly signature: string;
}

export interface StoreResult {
  readonly ok: boolean;
  readonly error?: string;
}

/** Dient een schrijfopdracht in bij de store-service; schrijft nooit zelf. */
export async function storeDraftViaService(
  record: StoreRecord,
  settlement: StoreSettlementProof,
  baseUrl: string = STORE_URL,
): Promise<StoreResult> {
  try {
    const res = await fetch(`${baseUrl}/store`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ record, settlement }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `store-service ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const DECISION_STORE_PATH =
  process.env.DECISION_STORE_PATH ?? "/data/decisions.jsonl";

export const EVIDENCE_STORE_PATH =
  process.env.EVIDENCE_STORE_PATH ?? "/data/evidence.jsonl";

/** Read-side voor beslissingen; zelfde read-only mount als listDrafts. */
export async function listDecisions(
  limit = 100,
  path: string = DECISION_STORE_PATH,
): Promise<readonly DecisionStoreRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as DecisionStoreRecord)
      .reverse();
  } catch {
    return [];
  }
}

/** Read-side voor opgeslagen evidence-ketens (read-only mount). */
export async function listEvidence(
  limit = 1000,
  path: string = EVIDENCE_STORE_PATH,
): Promise<readonly EvidenceStoreRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as EvidenceStoreRecord)
      .reverse();
  } catch {
    return [];
  }
}

/** Read-side voor de API; leest de read-only mount. */
export async function listDrafts(
  limit = 20,
  path: string = DRAFT_STORE_PATH,
): Promise<readonly DraftStoreRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as DraftStoreRecord)
      .reverse();
  } catch {
    return [];
  }
}
