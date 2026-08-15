/**
 * P1.4 Draft → review chain — open a concept, show review status, approve or
 * reject in-memory. Session only. No persistence, network, SQLite, Postgres
 * or store-service. Publish stays DENY after approved.
 */

import {
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  type FoundationViewModel,
  type P1AttentionItem,
  type P1Draft,
  type P1Project,
  type P1Publish,
  type P1Review,
  type ProjectView,
  type ReviewStatus,
} from "./p1-foundation.ts";
import {
  resolveMotorShell,
  tryPublish,
  type PublishAttempt,
  type ShellWriteReason,
} from "./p1-shell.ts";
import { mergeRosterSession, type RosterSession } from "./p1-roster.ts";
import { walkAttentionProjectConcept } from "./p1-workbench.ts";

export type ReviewDecision = "approve" | "reject";

export type ReviewPatch = {
  readonly draftId: string;
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly status: Extract<ReviewStatus, "in_review" | "approved" | "rejected">;
  readonly reviewId: string;
};

export type ReviewEvidenceRef = {
  readonly id: string;
  readonly kind: "reference" | "digest" | "receipt" | "hash";
  readonly status: "ready" | "missing";
  readonly digest?: string;
};

export type ReviewEvidenceView = {
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly refs: readonly ReviewEvidenceRef[];
};

export type ReviewPanel = {
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly projectId: string;
  readonly draftId: string;
  readonly headline: string;
  readonly status: ReviewStatus;
  readonly review: P1Review | null;
  readonly publish: P1Publish;
  readonly evidence: ReviewEvidenceView;
  readonly openedFrom: "inbox" | "workbench" | "attention";
};

export type ReviewAccess =
  | { readonly ok: true; readonly panel: ReviewPanel }
  | { readonly ok: false; readonly reason: ShellWriteReason; readonly panel: null };

export type ReviewDecisionResult =
  | { readonly ok: true; readonly patch: ReviewPatch }
  | { readonly ok: false; readonly reason: ShellWriteReason };

const EMPTY_REVIEW_PATCHES: readonly ReviewPatch[] = Object.freeze([]);

/** Local review decisions live only in this session object. */
export function reviewDecisionsAreDurable(): false {
  return false;
}

export function resetReviewPatches(): readonly ReviewPatch[] {
  return EMPTY_REVIEW_PATCHES;
}

function homeAccess(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
}): ReturnType<typeof resolveMotorShell> {
  if (input.actorTenantId !== input.workspaceId) {
    return { ok: false, reason: "tenant_denied", view: null };
  }
  return resolveMotorShell({
    authenticated: input.authenticated,
    requested: { workspace: input.workspaceId },
  });
}

function isHomeView(view: FoundationViewModel): boolean {
  return view.tenantId === HOME_TENANT_ID;
}

export function reviewStatusForDraft(
  draft: P1Draft,
  reviews: readonly P1Review[],
): ReviewStatus {
  const review = reviews.find((row) => row.draftId === draft.id);
  if (review) return review.state;
  return draft.state === "ready" ? "in_review" : "draft";
}

export function reviewStatusBadgeVariant(
  status: ReviewStatus,
): "outline" | "warning" | "success" | "denied" {
  if (status === "in_review") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected") return "denied";
  return "outline";
}

/** Fail-closed: unknown or foreign draft ids never select a row. */
export function resolveClientDraftId(
  view: FoundationViewModel,
  requested: string | null | undefined,
): string | null {
  if (!requested || !isHomeView(view)) return null;
  if (requested === OTHER_TENANT_ID || requested.startsWith("draft-noord")) return null;
  for (const row of view.projects) {
    if (row.project.tenantId !== HOME_TENANT_ID) continue;
    const draft = row.drafts.find((item) => item.id === requested && item.tenantId === HOME_TENANT_ID);
    if (draft) return draft.id;
  }
  return null;
}

function projectRowForDraft(view: FoundationViewModel, draftId: string): ProjectView | undefined {
  return view.projects.find(
    (row) =>
      row.project.tenantId === HOME_TENANT_ID &&
      row.drafts.some((draft) => draft.id === draftId && draft.tenantId === HOME_TENANT_ID),
  );
}

function denyPublish(projectId: string, draftId: string, reviewId: string): P1Publish {
  return {
    id: `publish-deny-${draftId}`,
    tenantId: HOME_TENANT_ID,
    projectId,
    reviewId,
    kind: "publish",
    decision: "DENY",
    reason: "P1-review heeft geen live-authority; publiceren blijft DENY na goedkeuring.",
    visibleAfterApproved: true,
  };
}

function publishForDraft(row: ProjectView, draftId: string, review: P1Review | null): P1Publish {
  const own = review ? row.publishes.find((item) => item.reviewId === review.id) : undefined;
  if (own) return own;
  return denyPublish(row.project.id, draftId, review?.id ?? `review-pending-${draftId}`);
}

function collectReviewEvidence(
  row: ProjectView,
  draft: P1Draft,
  attention: readonly P1AttentionItem[],
): ReviewEvidenceView {
  const refs: ReviewEvidenceRef[] = [];
  const seen = new Set<string>();
  const push = (ref: ReviewEvidenceRef) => {
    if (!ref.id || seen.has(ref.id)) return;
    seen.add(ref.id);
    refs.push(ref);
  };

  push({
    id: `hash-${draft.id}`,
    kind: "hash",
    status: "ready",
    digest: draft.bodyDigest,
  });
  push({
    id: row.project.context.manifestId,
    kind: "digest",
    status: row.project.context.status === "ready" ? "ready" : "missing",
    digest: row.project.context.digest,
  });

  for (const item of attention) {
    if (item.projectId !== row.project.id || item.tenantId !== HOME_TENANT_ID) continue;
    if (item.references.evidenceId) {
      push({ id: item.references.evidenceId, kind: "reference", status: "ready" });
    }
  }

  for (const artifact of row.artifacts) {
    if (artifact.kind === "digest" || artifact.kind === "receipt") {
      push({ id: artifact.id, kind: artifact.kind, status: "ready" });
    }
  }

  return { tenantId: HOME_TENANT_ID, refs };
}

function applyReviewPatches(
  view: FoundationViewModel,
  patches: readonly ReviewPatch[],
): FoundationViewModel {
  if (!isHomeView(view) || patches.length === 0) return view;

  const latest = new Map<string, ReviewPatch>();
  for (const patch of patches) {
    if (patch.tenantId !== HOME_TENANT_ID) continue;
    latest.set(patch.draftId, patch);
  }
  if (latest.size === 0) return view;

  const projects = view.projects.map((row) => {
    if (row.project.tenantId !== HOME_TENANT_ID) return row;
    const reviews: P1Review[] = [...row.reviews];
    let changed = false;
    for (const draft of row.drafts) {
      const patch = latest.get(draft.id);
      if (!patch) continue;
      const next: P1Review = {
        id: patch.reviewId,
        tenantId: HOME_TENANT_ID,
        projectId: row.project.id,
        draftId: draft.id,
        kind: "review",
        state: patch.status,
      };
      const index = reviews.findIndex((item) => item.draftId === draft.id);
      if (index >= 0) reviews[index] = next;
      else reviews.push(next);
      changed = true;
    }
    return changed ? { ...row, reviews } : row;
  });

  return { ...view, projects };
}

export function mergeReviewSession(
  view: FoundationViewModel,
  session: RosterSession,
  patches: readonly ReviewPatch[] = EMPTY_REVIEW_PATCHES,
): FoundationViewModel {
  return applyReviewPatches(mergeRosterSession(view, session), patches);
}

export function appendReviewPatch(
  patches: readonly ReviewPatch[],
  patch: ReviewPatch,
): readonly ReviewPatch[] {
  if (patch.tenantId !== HOME_TENANT_ID) return patches;
  return [...patches, patch];
}

export function openReviewPanel(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly draftId: string;
  readonly openedFrom?: ReviewPanel["openedFrom"];
  readonly view?: FoundationViewModel;
}): ReviewAccess {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason, panel: null };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const draftId = resolveClientDraftId(view, input.draftId);
  if (!draftId) return { ok: false, reason: "not_found", panel: null };

  const row = projectRowForDraft(view, draftId);
  const draft = row?.drafts.find((item) => item.id === draftId);
  if (!row || !draft) return { ok: false, reason: "not_found", panel: null };

  const review = row.reviews.find((item) => item.draftId === draftId) ?? null;
  const status = reviewStatusForDraft(draft, row.reviews);
  const publish = publishForDraft(row, draftId, review);

  return {
    ok: true,
    panel: {
      tenantId: HOME_TENANT_ID,
      projectId: row.project.id,
      draftId,
      headline: draft.title ?? "Concept",
      status,
      review,
      publish,
      evidence: collectReviewEvidence(row, draft, view.now.items),
      openedFrom: input.openedFrom ?? "workbench",
    },
  };
}

function currentReviewStatus(
  view: FoundationViewModel,
  draftId: string,
): { readonly draft: P1Draft; readonly row: ProjectView; readonly status: ReviewStatus } | null {
  const row = projectRowForDraft(view, draftId);
  const draft = row?.drafts.find((item) => item.id === draftId);
  if (!row || !draft) return null;
  return { draft, row, status: reviewStatusForDraft(draft, row.reviews) };
}

function decide(
  input: {
    readonly authenticated: boolean;
    readonly actorTenantId: string;
    readonly workspaceId: string;
    readonly draftId: string;
    readonly view?: FoundationViewModel;
  },
  required: ReviewStatus,
  next: ReviewPatch["status"],
): ReviewDecisionResult {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const draftId = resolveClientDraftId(view, input.draftId);
  if (!draftId) return { ok: false, reason: "not_found" };

  const current = currentReviewStatus(view, draftId);
  if (!current) return { ok: false, reason: "not_found" };
  if (current.status !== required) return { ok: false, reason: "invalid_transition" };

  const existing = current.row.reviews.find((item) => item.draftId === draftId);
  return {
    ok: true,
    patch: Object.freeze({
      draftId,
      tenantId: HOME_TENANT_ID,
      status: next,
      reviewId: existing?.id ?? `review-local-${draftId}`,
    }),
  };
}

export function submitDraftForReview(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly draftId: string;
  readonly view?: FoundationViewModel;
}): ReviewDecisionResult {
  return decide(input, "draft", "in_review");
}

export function decideReview(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly draftId: string;
  readonly decision: ReviewDecision;
  readonly view?: FoundationViewModel;
}): ReviewDecisionResult {
  return decide(input, "in_review", input.decision === "approve" ? "approved" : "rejected");
}

export function attemptReviewPublish(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly draftId?: string;
  readonly reviewId?: string;
}): PublishAttempt {
  return tryPublish({
    authenticated: input.authenticated,
    actorTenantId: input.actorTenantId,
    workspaceId: input.workspaceId,
    draftId: input.draftId,
    reviewId: input.reviewId,
  });
}

function draftForAttention(view: FoundationViewModel, item: P1AttentionItem): P1Draft | undefined {
  const row = view.projects.find((project) => project.project.id === item.projectId);
  if (!row || row.project.tenantId !== HOME_TENANT_ID) return undefined;
  const linked = row.drafts.find((draft) => item.id === `att-${draft.id}`);
  if (linked) return linked;
  return row.drafts[0];
}

export function walkAttentionProjectDraftReview(
  view: FoundationViewModel,
  attentionId: string,
): {
  readonly item: P1AttentionItem;
  readonly project: P1Project;
  readonly draft: P1Draft;
  readonly status: ReviewStatus;
  readonly review: P1Review | null;
  readonly publish: P1Publish;
  readonly evidence: ReviewEvidenceView;
} | null {
  const chain = walkAttentionProjectConcept(view, attentionId);
  if (!chain) return null;
  const draft = draftForAttention(view, chain.item);
  if (!draft) return null;
  const opened = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: draft.id,
    openedFrom: "attention",
    view,
  });
  if (!opened.ok) return null;
  return {
    item: chain.item,
    project: chain.project,
    draft,
    status: opened.panel.status,
    review: opened.panel.review,
    publish: opened.panel.publish,
    evidence: opened.panel.evidence,
  };
}
