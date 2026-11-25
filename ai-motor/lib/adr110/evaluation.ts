/**
 * ADR-110 Evaluation: the five active criteria computed purely from a causal
 * evidence chain. No other data source is consulted.
 *
 * (1)  task success rate        = successful outcomes / completed tasks
 * (2)  human corrections / 10   = total corrections / completed tasks * 10
 * (3)  unauthorized actions     = count of gateway.unauthorized_attempt records
 * (7)  cost per successful task = total cost_cents / successful tasks
 * (16) operator trust score     = mean review rating (approved 1, corrected 0.5, rejected 0)
 */

import type { EvaluationCriteria, EvidenceRecord } from "./types.ts";
import type { EvidenceChain } from "./evidence.ts";
import { UNAUTHORIZED_ATTEMPT_KIND } from "./evidence.ts";

export interface HumanReview {
  readonly rating: "approved" | "corrected" | "rejected";
  readonly corrections: number;
  readonly reviewed_by: string;
}

export interface OutcomeData {
  readonly status: "success" | "failure";
  readonly human_review?: HumanReview;
}

export interface CostData {
  readonly cost_cents: number;
}

const RATING_SCORE: Readonly<Record<HumanReview["rating"], number>> = {
  approved: 1,
  corrected: 0.5,
  rejected: 0,
};

function isOutcomeData(data: unknown): data is OutcomeData {
  if (data === null || typeof data !== "object") return false;
  const status = (data as { status?: unknown }).status;
  return status === "success" || status === "failure";
}

function isCostData(data: unknown): data is CostData {
  return (
    data !== null &&
    typeof data === "object" &&
    typeof (data as { cost_cents?: unknown }).cost_cents === "number"
  );
}

export function computeEvaluation(chain: EvidenceChain): EvaluationCriteria {
  const outcomes: EvidenceRecord[] = chain.records.filter(
    (r) => r.stage === "outcome" && isOutcomeData(r.data),
  );
  const completed = outcomes.length;
  const successful = outcomes.filter(
    (r) => (r.data as OutcomeData).status === "success",
  ).length;

  const corrections = outcomes.reduce((sum, r) => {
    const review = (r.data as OutcomeData).human_review;
    return sum + (review?.corrections ?? 0);
  }, 0);

  const unauthorized = chain.records.filter(
    (r) => r.kind_detail === UNAUTHORIZED_ATTEMPT_KIND,
  ).length;

  const totalCost = chain.records
    .filter((r) => isCostData(r.data))
    .reduce((sum, r) => sum + (r.data as CostData).cost_cents, 0);

  const reviews = outcomes
    .map((r) => (r.data as OutcomeData).human_review)
    .filter((r): r is HumanReview => r !== undefined);
  const trust =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, r) => sum + RATING_SCORE[r.rating], 0) /
        reviews.length;

  return Object.freeze({
    task_success_rate: completed === 0 ? 0 : successful / completed,
    human_corrections_per_10_tasks:
      completed === 0 ? 0 : (corrections / completed) * 10,
    unauthorized_actions: unauthorized,
    cost_per_successful_task_cents: successful === 0 ? totalCost : totalCost / successful,
    operator_trust_score: trust,
  });
}
