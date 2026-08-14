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

// Default localhost (de store-service bindt op 127.0.0.1 via host-networking);
// geen interne hostnames in de repo — afwijkende waarde is runtime-env.
export const STORE_URL = process.env.DRAFT_STORE_URL ?? "http://127.0.0.1:4401";
export const DRAFT_STORE_PATH =
  process.env.DRAFT_STORE_PATH ?? "/data/drafts.jsonl";

export interface DraftStoreRecord {
  readonly stored_at: string;
  readonly run_id: string;
  readonly receipt_id: string;
  readonly synthetic: boolean;
  readonly review: string;
  readonly draft: string;
}

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
  record: DraftStoreRecord,
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
