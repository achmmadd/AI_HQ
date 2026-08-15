/**
 * P1.4 Draft → review chain — acceptance tests (no browser, no live stack).
 *
 * 1. Attention / project → draft → review status
 * 2. Approve / reject in-memory, not durable
 * 3. Publish stays DENY after approved
 * 4. Tenant isolation via route / query / client-state
 * 5. Evidence view-model has ids/hashes/status only
 * 6. Sources stay synthetic
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  FORBIDDEN_VIEW_MARKERS,
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  REVIEW_STATUSES,
  serializeFoundationView,
} from "./p1-foundation.ts";
import {
  EMPTY_OVERLAY,
  mergeShellOverlay,
  prepareTypedDraft,
  resolveMotorShell,
  viewContainsForeignTenant,
} from "./p1-shell.ts";
import { EMPTY_ROSTER_SESSION } from "./p1-roster.ts";
import {
  appendReviewPatch,
  attemptReviewPublish,
  decideReview,
  mergeReviewSession,
  openReviewPanel,
  resetReviewPatches,
  resolveClientDraftId,
  reviewDecisionsAreDurable,
  reviewStatusForDraft,
  submitDraftForReview,
  walkAttentionProjectDraftReview,
} from "./p1-review.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function homeView() {
  const access = resolveMotorShell({
    authenticated: true,
    requested: { workspace: HOME_TENANT_ID },
  });
  assert.equal(access.ok, true);
  if (!access.ok) throw new Error("home view required");
  return access.view;
}

test("attention and project walk to a draft and its review status", () => {
  const view = homeView();
  assert.deepEqual([...REVIEW_STATUSES], ["draft", "in_review", "approved", "rejected"]);

  const approved = walkAttentionProjectDraftReview(view, "att-jij");
  assert.ok(approved);
  assert.equal(approved.item.projectId, "prj-review-keten");
  assert.equal(approved.project.id, "prj-review-keten");
  assert.equal(approved.draft.id, "draft-review-1");
  assert.equal(approved.status, "approved");
  assert.equal(approved.review?.state, "approved");
  assert.equal(approved.publish.decision, "DENY");
  assert.ok(approved.evidence.refs.some((ref) => ref.id === "ev-jij-1"));

  const pending = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    openedFrom: "inbox",
    view,
  });
  assert.equal(pending.ok, true);
  if (!pending.ok) return;
  assert.equal(pending.panel.status, "draft");
  assert.equal(pending.panel.review, null);
  assert.equal(pending.panel.openedFrom, "inbox");

  const open = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-open-1",
    openedFrom: "workbench",
    view,
  });
  assert.equal(open.ok, true);
  if (!open.ok) return;
  assert.equal(open.panel.status, "in_review");
  assert.equal(open.panel.review?.state, "in_review");

  const obs = walkAttentionProjectDraftReview(view, "att-obs-vraag");
  assert.ok(obs);
  assert.equal(obs.project.id, "prj-observatie-keten");
  assert.equal(obs.draft.id, "draft-obs-1");
  assert.equal(obs.status, "approved");
  assert.notEqual(obs.project.id, approved.project.id);

  const reviewProject = view.projects.find((row) => row.project.id === "prj-review-keten");
  assert.ok(reviewProject);
  const seen = new Set(
    reviewProject.drafts.map((draft) => reviewStatusForDraft(draft, reviewProject.reviews)),
  );
  assert.equal(seen.has("draft"), true);
  assert.equal(seen.has("in_review"), true);
  assert.equal(seen.has("approved"), true);
});

test("approve and reject stay in-memory and disappear after reset", () => {
  const view = homeView();
  const submitted = submitDraftForReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;

  const inReview = mergeReviewSession(view, EMPTY_ROSTER_SESSION, appendReviewPatch([], submitted.patch));
  const pendingRow = inReview.projects
    .find((row) => row.project.id === "prj-review-keten")
    ?.drafts.find((draft) => draft.id === "draft-pending-1");
  const pendingReviews =
    inReview.projects.find((row) => row.project.id === "prj-review-keten")?.reviews ?? [];
  assert.ok(pendingRow);
  assert.equal(reviewStatusForDraft(pendingRow, pendingReviews), "in_review");

  const approved = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    decision: "approve",
    view: inReview,
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  const afterApprove = mergeReviewSession(
    view,
    EMPTY_ROSTER_SESSION,
    appendReviewPatch(appendReviewPatch([], submitted.patch), approved.patch),
  );
  const approvedPanel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view: afterApprove,
  });
  assert.equal(approvedPanel.ok, true);
  if (approvedPanel.ok) assert.equal(approvedPanel.panel.status, "approved");

  const rejected = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-open-1",
    decision: "reject",
    view,
  });
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  const afterReject = mergeReviewSession(
    view,
    EMPTY_ROSTER_SESSION,
    appendReviewPatch([], rejected.patch),
  );
  const rejectedPanel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-open-1",
    view: afterReject,
  });
  assert.equal(rejectedPanel.ok, true);
  if (rejectedPanel.ok) assert.equal(rejectedPanel.panel.status, "rejected");

  const reset = mergeReviewSession(view, EMPTY_ROSTER_SESSION, resetReviewPatches());
  const restoredPending = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view: reset,
  });
  const restoredOpen = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-open-1",
    view: reset,
  });
  assert.equal(restoredPending.ok, true);
  assert.equal(restoredOpen.ok, true);
  if (restoredPending.ok) assert.equal(restoredPending.panel.status, "draft");
  if (restoredOpen.ok) assert.equal(restoredOpen.panel.status, "in_review");
  assert.equal(reviewDecisionsAreDurable(), false);

  const seed = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(seed);
  const seedPending = seed.projects
    .find((row) => row.project.id === "prj-review-keten")
    ?.reviews.find((review) => review.draftId === "draft-pending-1");
  assert.equal(seedPending, undefined);
  assert.equal(
    seed.projects
      .find((row) => row.project.id === "prj-review-keten")
      ?.reviews.find((review) => review.draftId === "draft-open-1")?.state,
    "in_review",
  );
});

test("publish stays DENY on the review panel after an approved review", () => {
  const view = homeView();
  const submitted = submitDraftForReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const inReview = mergeReviewSession(view, EMPTY_ROSTER_SESSION, appendReviewPatch([], submitted.patch));
  const approved = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    decision: "approve",
    view: inReview,
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) return;

  const merged = mergeReviewSession(
    view,
    EMPTY_ROSTER_SESSION,
    appendReviewPatch(appendReviewPatch([], submitted.patch), approved.patch),
  );
  const panel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view: merged,
  });
  assert.equal(panel.ok, true);
  if (!panel.ok) return;
  assert.equal(panel.panel.status, "approved");
  assert.equal(panel.panel.publish.decision, "DENY");
  assert.equal(panel.panel.publish.visibleAfterApproved, true);

  const attempt = attemptReviewPublish({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: panel.panel.draftId,
    reviewId: panel.panel.review?.id,
  });
  assert.equal(attempt.ok, false);
  assert.equal(attempt.decision, "DENY");
  assert.equal(attempt.visible, true);
  assert.equal(attempt.reason, "publish_denied");

  const seedApproved = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-review-1",
    view,
  });
  assert.equal(seedApproved.ok, true);
  if (!seedApproved.ok) return;
  assert.equal(seedApproved.panel.status, "approved");
  assert.equal(seedApproved.panel.publish.decision, "DENY");
});

test("foreign tenant stays invisible via route, query or client-state", () => {
  const attacks: Parameters<typeof resolveMotorShell>[0][] = [
    { authenticated: true, requested: { workspace: OTHER_TENANT_ID } },
    { authenticated: true, requested: { pathSegments: [OTHER_TENANT_ID] } },
    { authenticated: true, requested: { query: { workspace: OTHER_TENANT_ID } } },
    { authenticated: true, requested: { query: { tenant: OTHER_TENANT_ID, draft: "draft-review-1" } } },
    {
      authenticated: true,
      requested: { workspace: HOME_TENANT_ID, query: { tenant: OTHER_TENANT_ID } },
    },
  ];
  for (const attack of attacks) {
    const access = resolveMotorShell(attack);
    assert.equal(access.ok, false, `attack should fail: ${JSON.stringify(attack.requested)}`);
    if (access.ok) continue;
    assert.equal(access.view, null);
    assert.equal(JSON.stringify(access).includes("Noordkaap"), false);
  }

  const view = homeView();
  assert.equal(resolveClientDraftId(view, "draft-noord-1"), null);
  assert.equal(resolveClientDraftId(view, OTHER_TENANT_ID), null);
  assert.equal(resolveClientDraftId(view, "draft-onbekend"), null);
  assert.equal(viewContainsForeignTenant(view), false);

  const foreignPanel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-noord-1",
  });
  assert.equal(foreignPanel.ok, false);
  assert.equal(foreignPanel.panel, null);
  assert.equal(JSON.stringify(foreignPanel).includes("Noordkaap"), false);

  const otherWorkspace = openReviewPanel({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    draftId: "draft-review-1",
  });
  assert.equal(otherWorkspace.ok, false);
  if (!otherWorkspace.ok) assert.equal(otherWorkspace.reason, "tenant_denied");

  const foreignDecide = decideReview({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    draftId: "draft-review-1",
    decision: "approve",
  });
  assert.equal(foreignDecide.ok, false);
  if (!foreignDecide.ok) assert.equal(foreignDecide.reason, "tenant_denied");

  const unauthenticated = openReviewPanel({
    authenticated: false,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-review-1",
  });
  assert.equal(unauthenticated.ok, false);
  if (!unauthenticated.ok) assert.equal(unauthenticated.reason, "auth_required");

  assert.equal(walkAttentionProjectDraftReview(view, "att-noordkaap"), null);
});

test("evidence view-model exposes ids, hashes and status — never draft or context text", () => {
  const view = homeView();
  const prepared = prepareTypedDraft({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: "prj-review-keten",
    title: "VERTROUWELIJKE-DRAFT-TITEL-NIET-IN-EVIDENCE",
    body: "VOLLEDIGE-DRAFT-BODY-ANNEX-NIET-TONEN",
    nonce: "p14-evidence-1",
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const withDraft = mergeShellOverlay(view, {
    ...EMPTY_OVERLAY,
    drafts: [prepared.draft],
    attention: [prepared.attention],
  });
  const panel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: prepared.draft.id,
    view: withDraft,
  });
  assert.equal(panel.ok, true);
  if (!panel.ok) return;

  const evidence = panel.panel.evidence;
  assert.equal(evidence.tenantId, HOME_TENANT_ID);
  assert.ok(evidence.refs.length >= 2);
  for (const ref of evidence.refs) {
    assert.ok(ref.id.length > 0);
    assert.ok(["reference", "digest", "receipt", "hash"].includes(ref.kind));
    assert.ok(ref.status === "ready" || ref.status === "missing");
    assert.equal("title" in ref, false);
    assert.equal("body" in ref, false);
    assert.equal("label" in ref, false);
    assert.equal("summary" in ref, false);
    assert.equal("content" in ref, false);
  }
  assert.ok(evidence.refs.some((ref) => ref.kind === "hash" && ref.digest === prepared.draft.bodyDigest));
  assert.ok(evidence.refs.some((ref) => ref.digest?.startsWith("sha256:")));

  const blob = JSON.stringify(evidence);
  assert.equal(blob.includes("VERTROUWELIJKE-DRAFT-TITEL-NIET-IN-EVIDENCE"), false);
  assert.equal(blob.includes("VOLLEDIGE-DRAFT-BODY-ANNEX-NIET-TONEN"), false);
  assert.equal(blob.includes("FULL_CONTEXT_BODY"), false);
  assert.equal(blob.includes("[runtime] TRACE"), false);
  for (const marker of Object.values(FORBIDDEN_VIEW_MARKERS)) {
    assert.equal(blob.includes(marker), false, `evidence leaked ${marker}`);
  }
});

test("invalid transitions fail closed and pending concepts keep their own DENY publish", () => {
  const view = homeView();
  const seedPublish = view.projects
    .find((row) => row.project.id === "prj-review-keten")
    ?.publishes.find((item) => item.reviewId === "review-review-1");
  assert.ok(seedPublish);

  const fromDraftApprove = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    decision: "approve",
    view,
  });
  assert.equal(fromDraftApprove.ok, false);
  if (!fromDraftApprove.ok) assert.equal(fromDraftApprove.reason, "invalid_transition");
  assert.equal("patch" in fromDraftApprove, false);

  const fromDraftReject = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    decision: "reject",
    view,
  });
  assert.equal(fromDraftReject.ok, false);
  if (!fromDraftReject.ok) assert.equal(fromDraftReject.reason, "invalid_transition");

  const submitted = submitDraftForReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const inReview = mergeReviewSession(view, EMPTY_ROSTER_SESSION, appendReviewPatch([], submitted.patch));

  const resubmitOpen = submitDraftForReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view: inReview,
  });
  assert.equal(resubmitOpen.ok, false);
  if (!resubmitOpen.ok) assert.equal(resubmitOpen.reason, "invalid_transition");

  const approved = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    decision: "approve",
    view: inReview,
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  const afterApprove = mergeReviewSession(
    view,
    EMPTY_ROSTER_SESSION,
    appendReviewPatch(appendReviewPatch([], submitted.patch), approved.patch),
  );

  const resubmitFinal = submitDraftForReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view: afterApprove,
  });
  assert.equal(resubmitFinal.ok, false);
  if (!resubmitFinal.ok) assert.equal(resubmitFinal.reason, "invalid_transition");

  const flip = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    decision: "reject",
    view: afterApprove,
  });
  assert.equal(flip.ok, false);
  if (!flip.ok) assert.equal(flip.reason, "invalid_transition");

  const seedApprovedFlip = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-review-1",
    decision: "reject",
    view,
  });
  assert.equal(seedApprovedFlip.ok, false);
  if (!seedApprovedFlip.ok) assert.equal(seedApprovedFlip.reason, "invalid_transition");

  const pendingPanel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-pending-1",
    view,
  });
  assert.equal(pendingPanel.ok, true);
  if (!pendingPanel.ok) return;
  assert.equal(pendingPanel.panel.publish.decision, "DENY");
  assert.equal(pendingPanel.panel.publish.id, "publish-deny-draft-pending-1");
  assert.notEqual(pendingPanel.panel.publish.id, seedPublish.id);
  assert.notEqual(pendingPanel.panel.publish.reviewId, seedPublish.reviewId);

  const openPanel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: "draft-open-1",
    view,
  });
  assert.equal(openPanel.ok, true);
  if (!openPanel.ok) return;
  assert.equal(openPanel.panel.publish.decision, "DENY");
  assert.equal(openPanel.panel.publish.id, "publish-deny-draft-open-1");
  assert.notEqual(openPanel.panel.publish.reviewId, seedPublish.reviewId);
});

test("review sources stay synthetic: no persistence, media, decision API, or raw context", () => {
  const files = [
    readFileSync(join(ROOT, "pilot/p1-review.ts"), "utf8"),
    readFileSync(join(ROOT, "components/p1/p1-review-panel.tsx"), "utf8"),
    readFileSync(join(ROOT, "components/p1/p1-foundation-shell.tsx"), "utf8"),
  ].join("\n");
  for (const needle of [
    "better-sqlite3",
    "postgres",
    "drizzle",
    "node:fs",
    "getUserMedia",
    "FULL_CONTEXT_BODY",
    "[runtime] TRACE",
    "sk-live",
    "Noordkaap",
    "POST /decision",
    "/decision",
  ]) {
    assert.equal(files.includes(needle), false, `P1.4 source leaked ${needle}`);
  }
  assert.match(files, /Publish: DENY|publish\.decision|DENY/);
  assert.match(files, /in_review|approved|rejected/);
  assert.match(files, /status === "draft"/);
  assert.match(files, /status === "in_review"/);
  assert.match(files, /invalid_transition/);
});
