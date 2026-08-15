/**
 * decision-core.ts — koppeling 2 van de Motor shadow-pilot: de menselijke
 * beslissing (goedkeuren/afkeuren) over een opgeslagen concept.
 *
 * Dezelfde keten als de draft-flow, zonder model: gateway mint een receipt
 * voor capability "draft.decision", het settlement wordt HMAC-ondertekend en
 * de store-service schrijft naar decisions.jsonl. Eén beslissing per concept
 * (first-decision-wins; append-only). Publiceren blijft ook ná goedkeuring
 * geblokkeerd — de beslissing is bewijs, geen uitvoeringsmachtiging.
 *
 * De notitie van de operator leeft alleen in het privé-volume, nooit in
 * evidence of logs (zelfde redaction-regel als review-/concepttekst).
 */

import {
  ADR110_SCHEMA_VERSION,
  branded,
  isoTimestamp,
  deepFreeze,
  makeEvidenceRecord,
  buildEvidenceChain,
  findOrphans,
  createGateway,
} from "../lib/adr110/index.ts";
import type {
  ActionRequest,
  AttemptId,
  EmployeeId,
  EvidenceRecord,
  IdentityId,
  RunId,
  TaskId,
  WorkspaceId,
} from "../lib/adr110/index.ts";
import { buildPilotPolicy } from "./draft-core.ts";
import {
  listDecisions,
  listDrafts,
  storeDraftViaService,
} from "./draft-store.ts";
import type { DecisionStoreRecord } from "./draft-store.ts";
import { isValidStoreSecret, signSettlement } from "./settlement.ts";

export interface DecisionRequest {
  readonly draftRunId: string;
  readonly decision: "approved" | "rejected";
  readonly note?: string;
  /**
   * Tenancy (P0.8): de API geeft hier de ACL-vastgestelde workspace door;
   * de concept- en beslissinglookup zijn daarmee per definitie beperkt tot
   * die workspace. Ontbreekt hij (oudere testpaden), dan geldt "ws-motor".
   */
  readonly workspaceId?: string;
}

export interface DecisionDeps {
  readonly storeFn?: typeof storeDraftViaService;
  readonly storeSecret?: string;
  readonly listDraftsImpl?: typeof listDrafts;
  readonly listDecisionsImpl?: typeof listDecisions;
}

function nowIso() {
  return isoTimestamp(new Date().toISOString());
}

export async function runDecision(req: DecisionRequest, deps: DecisionDeps = {}) {
  const listDraftsImpl = deps.listDraftsImpl ?? listDrafts;
  const listDecisionsImpl = deps.listDecisionsImpl ?? listDecisions;
  const storeFn = deps.storeFn ?? storeDraftViaService;
  const workspace = req.workspaceId ?? "ws-motor";

  // De beslissing verwijst naar een bestaand, opgeslagen concept — binnen de
  // eigen workspace (P0.8): een run_id van een andere tenant bestaat hier
  // niet en volgt het gewone not-found-pad.
  const drafts = await listDraftsImpl(500, undefined, workspace);
  if (!drafts.some((d) => d.run_id === req.draftRunId)) {
    return { ok: false as const, error: "draft_not_found" };
  }
  // First-decision-wins: append-only betekent geen herschreven beslissingen.
  // Ook deze check is per workspace; de store handhaaft de claim atomisch
  // in dezelfde scope.
  const decisions = await listDecisionsImpl(1000, undefined, workspace);
  if (decisions.some((d) => d.draft_run_id === req.draftRunId)) {
    return { ok: false as const, error: "already_decided" };
  }

  const t0 = nowIso();
  const label = `decision-${Date.parse(t0)}`;
  const workspace_id = branded<WorkspaceId>(workspace);
  const task_id = branded<TaskId>(`task-decision-${req.draftRunId}`);
  const run_id = branded<RunId>(`run-${label}`);
  const attempt_id = branded<AttemptId>(`att-${label}`);

  // De beslisser is de menselijke eigenaar — geen employee-agent. Het
  // ActionRequest-contract vereist een EmployeeId als requested_by; de
  // eigenaar treedt hier op als operator (geen autonome medewerker).
  const identity = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    identity_id: branded<IdentityId>("identity-owner-pietje"),
    kind: "human" as const,
    display_name: "Pietje (eigenaar)",
    workspace_id,
  });
  const operator = branded<EmployeeId>("employee-owner-operator");

  const policy = buildPilotPolicy(workspace_id);
  const gateway = createGateway(policy);

  const actionRequest: ActionRequest = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    action_id: branded(`act-${label}-decision`),
    workspace_id,
    task_id,
    run_id,
    attempt_id,
    capability: "draft.decision",
    tool: "draft.decision.local",
    args: {
      draft_run_id: req.draftRunId,
      decision: req.decision,
      note: req.note?.trim() || null,
    },
    data_class: "internal",
    estimated_cost_cents: 0,
    requested_by: operator,
    requested_at: t0,
  });

  const minted = gateway.mintReceipt(actionRequest, t0);
  if (!minted.ok) {
    return { ok: false as const, error: minted.reasons.join("; ") };
  }
  const tEnd = nowIso();
  const settled = gateway.executeAction(actionRequest, minted.receipt, tEnd);
  if (!settled.executed) {
    return { ok: false as const, error: settled.reason };
  }

  const record: DecisionStoreRecord = {
    type: "decision",
    workspace_id: workspace_id as string,
    decided_at: tEnd,
    draft_run_id: req.draftRunId,
    decision: req.decision,
    note: req.note?.trim() || null,
    decided_by: identity.identity_id as string,
    receipt_id: settled.settlement.receipt_id,
  };

  const storeSecret = deps.storeSecret ?? process.env.PILOT_STORE_SECRET;
  if (!storeSecret || !isValidStoreSecret(storeSecret)) {
    return { ok: false as const, error: "store_secret_not_configured" };
  }
  const signed = signSettlement(
    storeSecret,
    {
      receipt_id: settled.settlement.receipt_id,
      action_id: settled.settlement.action_id,
      argument_hash: settled.settlement.argument_hash,
      executed_at: settled.settlement.executed_at,
      capability: minted.receipt.capability,
      tool: minted.receipt.tool,
      workspace_id: workspace_id as string,
      task_id: task_id as string,
      run_id: run_id as string,
      attempt_id: attempt_id as string,
      policy_id: policy.policy_id as string,
      policy_version: policy.version,
      policy_digest: policy.digest,
      issued_at: minted.receipt.minted_at,
    },
    record,
  );
  const stored = await storeFn(record, signed);
  // De store handhaaft één-beslissing-per-concept atomair; map dat hier op
  // dezelfde fout als de snelle pre-check.
  if (!stored.ok && stored.error?.includes("already_decided")) {
    return { ok: false as const, error: "already_decided" };
  }

  // Evidence-keten: task → run → attempt → action → outcome. De notitie en
  // conceptinhoud horen daar bewust NIET in — alleen id's en status.
  const evidence: EvidenceRecord[] = [];
  const evTask = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-task`),
    stage: "task",
    task_id,
    subject_id: task_id as string,
    kind_detail: "task.assigned",
    data: { kind: "draft.decision", draft_run_id: req.draftRunId },
    occurred_at: t0,
  });
  evidence.push(evTask);
  const evRun = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-run`),
    stage: "run",
    task_id,
    run_id,
    subject_id: run_id as string,
    parent_evidence_id: evTask.evidence_id,
    kind_detail: "run.started",
    data: { engine: "pilot-decision" },
    occurred_at: t0,
  });
  evidence.push(evRun);
  const evAttempt = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-attempt`),
    stage: "attempt",
    task_id,
    run_id,
    attempt_id,
    subject_id: attempt_id as string,
    parent_evidence_id: evRun.evidence_id,
    kind_detail: "decision.requested",
    data: { draft_run_id: req.draftRunId, decision: req.decision },
    occurred_at: t0,
  });
  evidence.push(evAttempt);
  const evAction = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-action`),
    stage: "action",
    task_id,
    run_id,
    attempt_id,
    subject_id: actionRequest.action_id as string,
    parent_evidence_id: evAttempt.evidence_id,
    kind_detail: "gateway.settlement.draft.decision",
    data: {
      decision: "ALLOW",
      executed: true,
      stored: stored.ok,
      receipt_id: settled.settlement.receipt_id,
      ...(stored.ok ? {} : { error: stored.error }),
    },
    occurred_at: tEnd,
  });
  evidence.push(evAction);
  const evOutcome = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-outcome`),
    stage: "outcome",
    task_id,
    run_id,
    attempt_id,
    subject_id: `outcome-${label}`,
    parent_evidence_id: evAction.evidence_id,
    kind_detail: "decision.recorded",
    data: {
      draft_run_id: req.draftRunId,
      decision: req.decision,
      stored: stored.ok,
    },
    occurred_at: tEnd,
  });
  evidence.push(evOutcome);

  const chain = buildEvidenceChain(evidence);
  const orphans = findOrphans(evidence);

  return {
    ok: stored.ok && chain.ok && orphans.length === 0,
    draft_run_id: req.draftRunId,
    decision: req.decision,
    stored: stored.ok,
    ...(stored.ok ? {} : { error: stored.error }),
    receipt_id: settled.settlement.receipt_id,
    evidence,
    chainValid: chain.ok,
    orphans: orphans.length,
  };
}
