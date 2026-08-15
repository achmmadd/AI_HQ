import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  isBlockExecutable,
  serializeFoundationView,
  tryMutateTenant,
  walkNowProjectDepartment,
} from "./p1-foundation.ts";
import { prepareTypedDraft, tryPublish } from "./p1-shell.ts";
import { EMPTY_ROSTER_SESSION } from "./p1-roster.ts";
import {
  decideReview,
  mergeReviewSession,
  openReviewPanel,
  reviewStatusForDraft,
  submitDraftForReview,
} from "./p1-review.ts";
import { collectWorkspaceEvidence, evidenceRailLeaksContent } from "./p1-evidence.ts";
import { openBlockGallery } from "./p1-blocks.ts";

test("P1 acceptance: one workspace walk stays tenant-scoped and publish-DENY", () => {
  const walk = walkNowProjectDepartment(HOME_TENANT_ID);
  assert.ok(walk);
  const home = serializeFoundationView(HOME_TENANT_ID)!;
  assert.deepEqual(home.nav.map((item) => item.label), ["Nu", "Projecten", "Afdelingen"]);

  const prepared = prepareTypedDraft({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: walk!.project.id,
    title: "Acceptatieconcept",
    nonce: "p1-accept",
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const seeded = mergeReviewSession(
    home,
    {
      ...EMPTY_ROSTER_SESSION,
      overlay: {
        drafts: [prepared.draft],
        attention: [prepared.attention],
        departments: [],
        assignments: [],
      },
    },
    [],
  );
  const draft = seeded.projects.flatMap((row) => row.drafts).find((item) => item.id === prepared.draft.id);
  assert.ok(draft);
  assert.equal(reviewStatusForDraft(draft!, seeded.projects.flatMap((row) => row.reviews)), "draft");

  const submitted = submitDraftForReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: prepared.draft.id,
    view: seeded,
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;

  const inReview = mergeReviewSession(home, {
    ...EMPTY_ROSTER_SESSION,
    overlay: {
      drafts: [prepared.draft],
      attention: [prepared.attention],
      departments: [],
      assignments: [],
    },
  }, [submitted.patch]);

  const decided = decideReview({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: prepared.draft.id,
    decision: "approve",
    view: inReview,
  });
  assert.equal(decided.ok, true);
  if (!decided.ok) return;

  const publish = tryPublish({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: prepared.draft.id,
    reviewId: decided.patch.reviewId,
  });
  assert.equal(publish.ok, false);
  assert.equal(publish.decision, "DENY");

  const approved = mergeReviewSession(home, {
    ...EMPTY_ROSTER_SESSION,
    overlay: {
      drafts: [prepared.draft],
      attention: [prepared.attention],
      departments: [],
      assignments: [],
    },
  }, [submitted.patch, decided.patch]);

  const panel = openReviewPanel({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: prepared.draft.id,
    openedFrom: "inbox",
    view: approved,
  });
  assert.equal(panel.ok, true);
  if (!panel.ok) return;
  assert.equal(panel.panel.status, "approved");
  assert.equal(panel.panel.publish.decision, "DENY");

  const rail = collectWorkspaceEvidence(approved);
  assert.equal(evidenceRailLeaksContent(rail, ["Acceptatieconcept"]), false);

  const gallery = openBlockGallery({
    authenticated: true,
    workspace: HOME_TENANT_ID,
    view: home,
  });
  assert.equal(gallery.ok, true);
  if (gallery.ok) assert.equal(gallery.gallery.executable, false);
  for (const block of home.blocks) {
    assert.equal(isBlockExecutable(block), false);
  }

  assert.equal(tryMutateTenant(HOME_TENANT_ID, OTHER_TENANT_ID).ok, false);
  const other = serializeFoundationView(OTHER_TENANT_ID);
  assert.ok(other);
  assert.notEqual(other!.organizationName, home.organizationName);
});
