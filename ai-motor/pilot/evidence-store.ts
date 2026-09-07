/**
 * evidence-store.ts — koppeling 3 van de Motor shadow-pilot: de gevalideerde
 * evidence-keten van een run zelf ook bewaren, via exact hetzelfde patroon
 * als draft.store en draft.decision (gateway-receipt → HMAC-settlement →
 * store-service → evidence.jsonl).
 *
 * Waarom: de vijf actieve meetcriteria (START-HIER) worden door
 * adr110/evaluation.ts uit een evidence-keten berekend. Zonder persistentie
 * is die keten vluchtig (alleen in het API-antwoord) en is meten onmogelijk.
 *
 * Twee bewuste grenzen:
 * - Alleen een VALIDE keten (chain.ok, 0 orphans) wordt opgeslagen; een
 *   gebroken keten vervuilt de metingen nooit.
 * - De evidence.store-actie zelf staat NIET in de opgeslagen keten (dat zou
 *   recursief zijn); alleen haar receipt_id staat in het store-record. In de
 *   teruggegeven output verschijnt de actie als apart outcome-veld, net als
 *   storeOutcome bij koppeling 1.
 */

import {
  ADR110_SCHEMA_VERSION,
  branded,
  deepFreeze,
  digestOf,
  isoTimestamp,
} from "../lib/adr110/index.ts";
import type {
  ActionRequest,
  AttemptId,
  EmployeeId,
  EvidenceRecord,
  Gateway,
  RunId,
  TaskId,
  WorkspaceId,
} from "../lib/adr110/index.ts";
import { storeDraftViaService } from "./draft-store.ts";
import type { EvidenceStoreRecord } from "./draft-store.ts";
import { signSettlement } from "./settlement.ts";

export type EvidenceStoreOutcome =
  | {
      readonly decision: "ALLOW";
      readonly executed: true;
      readonly stored: boolean;
      readonly path: string;
      readonly receipt_id: string;
      readonly error?: string;
    }
  | {
      readonly decision: "DENY" | "REQUIRE_APPROVAL";
      readonly executed: false;
      readonly stored: false;
      readonly reason: string;
    };

export interface StoreEvidenceParams {
  readonly gateway: Gateway;
  readonly workspace_id: WorkspaceId;
  readonly task_id: TaskId;
  readonly run_id: RunId;
  readonly attempt_id: AttemptId;
  /** De acteur: de employee-agent bij een draft-run, de operator bij een beslissing. */
  readonly requested_by: EmployeeId;
  readonly evidence: readonly EvidenceRecord[];
  /** Tijdslabel van de run (bijv. "shadow-<ms>" / "decision-<ms>"). */
  readonly label: string;
  readonly storeFn: typeof storeDraftViaService;
  readonly storeSecret?: string;
}

/**
 * Mint een receipt voor capability "evidence.store", settle via de gateway en
 * dient het record in bij de store-service. Zonder store-secret wordt er —
 * net als bij koppeling 1 — expliciet NIET opgeslagen.
 */
export async function storeEvidenceChain(
  params: StoreEvidenceParams,
): Promise<EvidenceStoreOutcome> {
  const {
    gateway,
    workspace_id,
    task_id,
    run_id,
    attempt_id,
    requested_by,
    evidence,
    label,
    storeFn,
  } = params;
  const storeSecret = params.storeSecret ?? process.env.PILOT_STORE_SECRET;
  const path = "/data/evidence.jsonl (via store-service)";
  const storedAt = isoTimestamp(new Date().toISOString());

  const record: EvidenceStoreRecord = {
    type: "evidence",
    stored_at: storedAt,
    run_id: run_id as string,
    receipt_id: "", // wordt hieronder gevuld zodra de settlement er is
    chain_digest: digestOf(evidence),
    record_count: evidence.length,
    records: evidence,
  };

  const actionRequest: ActionRequest = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    action_id: branded(`act-${label}-evidence`),
    workspace_id,
    task_id,
    run_id,
    attempt_id,
    capability: "evidence.store",
    tool: "evidence.store.local",
    // Contentloze args: de receipt bindt aan de chain-digest, niet aan inhoud.
    args: {
      run_id: run_id as string,
      record_count: evidence.length,
      chain_digest: record.chain_digest,
    },
    data_class: "internal",
    estimated_cost_cents: 0,
    requested_by,
    requested_at: storedAt,
  });

  const minted = gateway.mintReceipt(actionRequest, storedAt);
  if (!minted.ok) {
    return {
      decision: minted.decision,
      executed: false,
      stored: false,
      reason: minted.reasons.join("; "),
    };
  }
  const settled = gateway.executeAction(
    actionRequest,
    minted.receipt,
    isoTimestamp(new Date().toISOString()),
  );
  if (!settled.executed) {
    return {
      decision: "DENY",
      executed: false,
      stored: false,
      reason: settled.reason,
    };
  }

  const boundRecord: EvidenceStoreRecord = {
    ...record,
    receipt_id: settled.settlement.receipt_id,
  };
  if (!storeSecret) {
    return {
      decision: "ALLOW",
      executed: true,
      stored: false,
      path,
      receipt_id: settled.settlement.receipt_id,
      error: "store_secret_not_configured",
    };
  }
  const signed = signSettlement(storeSecret, settled.settlement, boundRecord);
  const stored = await storeFn(boundRecord, signed);
  return {
    decision: "ALLOW",
    executed: true,
    stored: stored.ok,
    path,
    receipt_id: settled.settlement.receipt_id,
    ...(stored.ok ? {} : { error: stored.error }),
  };
}
