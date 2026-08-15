/**
 * draft-store.ts — client voor de draft.store-koppeling + read-side.
 *
 * Scheiding volgens de pilot-regels:
 * - SCHRIJVEN gebeurt uitsluitend door de store-service (pilot/store-service.ts),
 *   de action-driver binnen de trust boundary van de gateway. Deze module is
 *   alleen de client die ná een gateway-settlement de schrijfopdracht indient.
 * - LEZEN (listDrafts) gebeurt door de API via een read-only mount van /data;
 *   de API kan fysiek niet schrijven (docker :ro).
 *
 * Tenancy (P0.8): workspace_id is een VERPLICHT veld op ieder record. De
 * store-service weigert writes zonder (400, fail-closed) en de read-side
 * filtert per workspace; legacy-regels zonder het veld (demo-data van vóór
 * P0.8) zijn daardoor voor elke workspace onzichtbaar.
 */

import { readFile } from "node:fs/promises";

// Default localhost (de store-service bindt op 127.0.0.1 via host-networking);
// geen interne hostnames in de repo — afwijkende waarde is runtime-env.
export const STORE_URL = process.env.DRAFT_STORE_URL ?? "http://127.0.0.1:4401";
export const DRAFT_STORE_PATH =
  process.env.DRAFT_STORE_PATH ?? "/data/drafts.jsonl";

export interface DraftStoreRecord {
  /** Routering in de store-service; oude records zonder type = "draft". */
  readonly type?: "draft";
  /**
   * Verplichte tenancy (P0.8). De store-service weigert records zonder dit
   * veld en de read-side toont een record alleen aan zijn eigen workspace.
   */
  readonly workspace_id: string;
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
  /** Verplichte tenancy (P0.8), zie DraftStoreRecord. */
  readonly workspace_id: string;
  readonly decided_at: string;
  readonly draft_run_id: string;
  readonly decision: "approved" | "rejected";
  readonly note: string | null;
  readonly decided_by: string;
  readonly receipt_id: string;
}

export type StoreRecord = DraftStoreRecord | DecisionStoreRecord;

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

/**
 * Fail-closed tenancy-filter (P0.8). Met een workspaceId zijn alleen records
 * zichtbaar die exact die workspace dragen; legacy-regels zonder workspace_id
 * (demo-data van vóór P0.8) horen nergens aantoonbaar bij en vallen er onder
 * ieder filter uit. De filter gaat vóór de limit: "de recentste N van déze
 * workspace", nooit "filter de recentste N".
 *
 * Zonder workspaceId is de read ongefilterd — dat pad bestaat uitsluitend
 * voor interne/test-aanroepen; productiecallers (API, decision-flow) geven
 * altijd de server-side vastgestelde workspace mee, en de MCP-store-provider
 * filtert daarnaast zelf nog eens (defense-in-depth).
 */
function filterWorkspace<T extends { readonly workspace_id: string }>(
  records: readonly T[],
  workspaceId: string | undefined,
): readonly T[] {
  if (workspaceId === undefined) return records;
  return records.filter((r) => r.workspace_id === workspaceId);
}

/** Read-side voor beslissingen; zelfde read-only mount als listDrafts. */
export async function listDecisions(
  limit = 100,
  path: string = DECISION_STORE_PATH,
  workspaceId?: string,
): Promise<readonly DecisionStoreRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const records = lines.map((l) => JSON.parse(l) as DecisionStoreRecord);
    return filterWorkspace(records, workspaceId).slice(-limit).reverse();
  } catch {
    return [];
  }
}

/** Read-side voor de API; leest de read-only mount. */
export async function listDrafts(
  limit = 20,
  path: string = DRAFT_STORE_PATH,
  workspaceId?: string,
): Promise<readonly DraftStoreRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const records = lines.map((l) => JSON.parse(l) as DraftStoreRecord);
    return filterWorkspace(records, workspaceId).slice(-limit).reverse();
  } catch {
    return [];
  }
}
