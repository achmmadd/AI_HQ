/**
 * evaluation-core.ts — koppeling 3 read-side: de vijf actieve meetcriteria
 * (START-HIER) berekend uit de OPGESLAGEN evidence-ketens.
 *
 * De berekening zelf is de ADR-110-proof (adr110/evaluation.ts); deze module
 * doet alleen de ophaal- en integriteitslaag:
 *
 * - dedupe op run_id (append-only, maar defensief);
 * - elke opgeslagen keten wordt opnieuw gevalideerd (digest + orphan-check
 *   via buildEvidenceChain): een gemanipuleerde regel in evidence.jsonl valt
 *   uit de meting in plaats van hem te vervuilen, en telt zichtbaar mee in
 *   chains_skipped_invalid;
 * - de criteria rekenen over de samengevoegde records van alle valide
 *   ketens — computeEvaluation telt outcomes, unauthorized-pogingen, kosten
 *   en menselijke reviews over de hele set.
 *
 * Er wordt nooit bedrijfsinhoud gelezen of teruggegeven: evidence bevat per
 * ontwerp alleen id's, hashes, omvang en status.
 */

import { buildEvidenceChain, computeEvaluation } from "../lib/adr110/index.ts";
import type {
  EvaluationCriteria,
  EvidenceRecord,
} from "../lib/adr110/index.ts";
import { EVIDENCE_STORE_PATH, listEvidence } from "./draft-store.ts";

export interface PilotEvaluation {
  readonly ok: true;
  /** Aantal opgeslagen ketens in evidence.jsonl (vóór dedupe/validatie). */
  readonly chains_stored: number;
  /** Ketens die daadwerkelijk meetellen (valide, gededupliceerd). */
  readonly chains_used: number;
  /** Ketens die bij het lezen niet meer valide bleken (tamper-signaal). */
  readonly chains_skipped_invalid: number;
  /** Totaal aantal evidence-records waarover gerekend is. */
  readonly records_used: number;
  readonly criteria: EvaluationCriteria;
}

export interface EvaluationDeps {
  readonly listEvidenceImpl?: typeof listEvidence;
}

export async function computeStoredEvaluation(
  deps: EvaluationDeps = {},
  path: string = EVIDENCE_STORE_PATH,
): Promise<PilotEvaluation> {
  const listEvidenceImpl = deps.listEvidenceImpl ?? listEvidence;
  const stored = await listEvidenceImpl(1000, path);

  const seenRuns = new Set<string>();
  const records: EvidenceRecord[] = [];
  let skipped = 0;
  for (const entry of stored) {
    if (seenRuns.has(entry.run_id)) continue;
    seenRuns.add(entry.run_id);
    // Integriteit boven inhoud: alleen een opnieuw-valide keten meetellen.
    const chain = buildEvidenceChain(entry.records);
    if (!chain.ok) {
      skipped += 1;
      continue;
    }
    records.push(...chain.chain.records);
  }

  return {
    ok: true,
    chains_stored: stored.length,
    chains_used: seenRuns.size - skipped,
    chains_skipped_invalid: skipped,
    records_used: records.length,
    criteria: computeEvaluation({ records }),
  };
}
