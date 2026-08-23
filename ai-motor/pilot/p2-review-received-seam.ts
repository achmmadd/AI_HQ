/**
 * Local in-process ReviewReceived seam for P2.1 draft creation.
 *
 * ReviewReceived is a non-persisted local label only — never a journal event
 * type or JSON key. The only write is the existing draft_created event, and
 * only after verifiedActor is supplied by the motor server (WhoIs + PILOT_P2_ACL).
 * Hostname, IP, header and client-body actor values are never authority.
 */

import { HOME_TENANT_ID } from "./p1-foundation.ts";
import { p2ContextWriteError, resolveP2ContextGate } from "./p2-context-gate.ts";
import { NUC_ORCHESTRATOR_STABLE_ID, isStableNodeId } from "./p2-orchestrator.ts";
import type { P0ReferenceResolver } from "./p2-p0-reference.ts";
import {
  buildDraftCreatedEvent,
  type P2JournalEvent,
  type ReviewJournal,
} from "./p2-review-journal.ts";

export type VerifiedReviewActor = {
  readonly workspaceId: string;
  readonly stableId: string;
};

export type ReviewReceivedDeps = {
  readonly verifiedActor: VerifiedReviewActor;
  readonly journal: ReviewJournal;
  readonly contextEnv: Record<string, string | undefined>;
  readonly resolveP0Reference?: P0ReferenceResolver;
};

export type ReviewReceivedResult =
  | { readonly ok: true; readonly event: P2JournalEvent }
  | { readonly ok: false; readonly reason: string };

function closedIntake(
  intake: Record<string, unknown>,
):
  | { ok: true; kind: "synthetic"; templateId: unknown }
  | { ok: true; kind: "p0"; sourceId: unknown }
  | { ok: false; reason: string } {
  const keys = Object.keys(intake);
  if (keys.length === 1 && keys[0] === "synthetic_template_id") {
    return { ok: true, kind: "synthetic", templateId: intake.synthetic_template_id };
  }
  if (keys.length === 2 && keys.includes("source_kind") && keys.includes("source_id")) {
    if (intake.source_kind !== "p0") return { ok: false, reason: "unknown_source_kind" };
    return { ok: true, kind: "p0", sourceId: intake.source_id };
  }
  return { ok: false, reason: "free_intake_not_allowed" };
}

function actorDenied(actor: VerifiedReviewActor): string | null {
  if (actor.workspaceId !== HOME_TENANT_ID) return "unknown_workspace";
  if (!isStableNodeId(actor.stableId) || actor.stableId === NUC_ORCHESTRATOR_STABLE_ID) {
    return "actor_denied";
  }
  return null;
}

export async function receiveSyntheticReview(
  intakeRaw: Record<string, unknown>,
  deps: ReviewReceivedDeps,
): Promise<ReviewReceivedResult> {
  const intake = closedIntake(intakeRaw);
  if (!intake.ok) return { ok: false, reason: intake.reason };

  const actorError = actorDenied(deps.verifiedActor);
  if (actorError) return { ok: false, reason: actorError };

  const contextError = p2ContextWriteError(resolveP2ContextGate(deps.contextEnv));
  if (contextError) return { ok: false, reason: contextError };

  const built = buildDraftCreatedEvent(
    intake.kind === "p0"
      ? { actorStableId: deps.verifiedActor.stableId, sourceId: String(intake.sourceId ?? "") }
      : { actorStableId: deps.verifiedActor.stableId, templateId: String(intake.templateId ?? "") },
    deps.resolveP0Reference,
  );
  if (!built.ok) return { ok: false, reason: built.reason };

  const committed = await deps.journal.commit(built.event);
  if (!committed.ok) return { ok: false, reason: committed.reason };
  return { ok: true, event: committed.event };
}
