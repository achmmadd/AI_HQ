/**
 * P1.2 Motor workbench — acceptance tests (no browser, no live stack).
 *
 * 1. Inbox filters + project navigation
 * 2. Tenant isolation via route/query/client-state
 * 3. Attention → project → draft/review/evidence
 * 4. Local assignment is not durable
 * 5. Publish stays DENY after approved
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
  serializeFoundationView,
} from "./p1-foundation.ts";
import {
  resolveMotorShell,
  tryPublish,
  viewContainsForeignTenant,
} from "./p1-shell.ts";
import {
  EMPTY_WORKBENCH_SESSION,
  appendAttentionPatch,
  appendProjectPatch,
  assignmentsAreDurable,
  filterInboxItems,
  inboxFilterOptions,
  mergeWorkbenchSession,
  openProjectWorkbench,
  reassignAttention,
  reassignProject,
  resetWorkbenchSession,
  resolveClientProjectId,
  walkAttentionProjectConcept,
} from "./p1-workbench.ts";

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

test("inbox filters by status, department and owner, then opens the matching project", () => {
  const view = homeView();
  const options = inboxFilterOptions(view);
  assert.ok(options.departments.some((row) => row.id === "dep-reviewkring"));
  assert.ok(options.departments.some((row) => row.id === "dep-koppelingen"));
  assert.ok(options.owners.some((row) => row.id === "emp-mira"));
  assert.ok(options.owners.some((row) => row.id === "emp-reviewer"));

  const byStatus = filterInboxItems(view, { status: "jij_nodig" });
  assert.ok(byStatus.length >= 2);
  assert.ok(byStatus.every((item) => item.stage === "jij_nodig"));
  assert.ok(byStatus.every((item) => item.tenantId === HOME_TENANT_ID));

  const byDepartment = filterInboxItems(view, { departmentId: "dep-koppelingen" });
  assert.ok(byDepartment.length >= 1);
  assert.ok(byDepartment.every((item) => item.departmentId === "dep-koppelingen"));
  assert.ok(byDepartment.every((item) => item.projectId === "prj-observatie-keten"));

  const byOwner = filterInboxItems(view, { ownerId: "emp-reviewer" });
  assert.ok(byOwner.length >= 1);
  assert.ok(byOwner.every((item) => item.ownerId === "emp-reviewer"));

  const combined = filterInboxItems(view, {
    status: "vraag",
    departmentId: "dep-koppelingen",
    ownerId: "emp-reviewer",
  });
  assert.equal(combined.length, 1);
  assert.equal(combined[0]?.id, "att-obs-vraag");

  const item = combined[0]!;
  const opened = openProjectWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: item.projectId,
    attentionId: item.id,
    view,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.workbench.project.id, "prj-observatie-keten");
  assert.equal(opened.workbench.project.tenantId, HOME_TENANT_ID);
  assert.equal(opened.workbench.openedFrom?.id, item.id);
  assert.equal(opened.workbench.department?.id, "dep-koppelingen");

  const reviewProject = filterInboxItems(view, { status: "jij_nodig", departmentId: "dep-reviewkring" })[0];
  assert.ok(reviewProject);
  const other = openProjectWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: reviewProject.projectId,
    attentionId: reviewProject.id,
    view,
  });
  assert.equal(other.ok, true);
  if (!other.ok) return;
  assert.equal(other.workbench.project.id, "prj-review-keten");
  assert.notEqual(other.workbench.project.id, opened.workbench.project.id);
});

test("foreign tenant stays invisible via route, query or client-state", () => {
  const attacks: Parameters<typeof resolveMotorShell>[0][] = [
    { authenticated: true, requested: { workspace: OTHER_TENANT_ID } },
    { authenticated: true, requested: { pathSegments: [OTHER_TENANT_ID] } },
    { authenticated: true, requested: { query: { workspace: OTHER_TENANT_ID } } },
    { authenticated: true, requested: { query: { tenant: OTHER_TENANT_ID, project: "prj-noordkaap-geheim" } } },
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
  assert.equal(resolveClientProjectId(view, "prj-noordkaap-geheim"), null);
  assert.equal(resolveClientProjectId(view, OTHER_TENANT_ID), null);
  assert.equal(resolveClientProjectId(view, "prj-onbekend"), null);

  const foreignWorkbench = openProjectWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: "prj-noordkaap-geheim",
  });
  assert.equal(foreignWorkbench.ok, false);
  assert.equal(foreignWorkbench.workbench, null);
  assert.equal(JSON.stringify(foreignWorkbench).includes("Noordkaap"), false);

  const foreignWorkspace = openProjectWorkbench({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    projectId: "prj-noordkaap-geheim",
  });
  assert.equal(foreignWorkspace.ok, false);
  if (!foreignWorkspace.ok) assert.equal(foreignWorkspace.reason, "tenant_denied");

  const filtered = filterInboxItems(view, { departmentId: "dep-noord-archief" });
  assert.equal(filtered.length, 0);
  assert.equal(viewContainsForeignTenant(view), false);

  const unauthenticated = openProjectWorkbench({
    authenticated: false,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: "prj-review-keten",
  });
  assert.equal(unauthenticated.ok, false);
  if (!unauthenticated.ok) assert.equal(unauthenticated.reason, "auth_required");
});

test("attention item walks to its own project, concept, review and evidence refs", () => {
  const view = homeView();
  const reviewChain = walkAttentionProjectConcept(view, "att-jij");
  assert.ok(reviewChain);
  assert.equal(reviewChain.project.id, "prj-review-keten");
  assert.ok(reviewChain.concepts.length >= 1);
  assert.equal(reviewChain.concepts[0]?.kind, "draft");
  assert.equal(reviewChain.review?.kind, "review");
  assert.equal(reviewChain.review?.state, "approved");
  assert.ok(reviewChain.evidenceIds.includes("ev-jij-1"));
  assert.equal(reviewChain.publish?.decision, "DENY");

  const obsChain = walkAttentionProjectConcept(view, "att-obs-vraag");
  assert.ok(obsChain);
  assert.equal(obsChain.item.projectId, "prj-observatie-keten");
  assert.equal(obsChain.project.id, "prj-observatie-keten");
  assert.notEqual(obsChain.project.id, reviewChain.project.id);
  assert.ok(obsChain.concepts.some((draft) => draft.id === "draft-obs-1"));
  assert.equal(obsChain.review?.state, "approved");
  assert.ok(obsChain.evidenceIds.includes("ev-obs-vraag-1"));
  assert.ok(obsChain.evidenceIds.includes("art-obs-digest"));
  assert.equal(obsChain.publish?.decision, "DENY");

  const blob = JSON.stringify(obsChain);
  for (const marker of Object.values(FORBIDDEN_VIEW_MARKERS)) {
    assert.equal(blob.includes(marker), false, `chain leaked ${marker}`);
  }
  assert.equal(blob.includes("FULL_CONTEXT_BODY"), false);
  assert.equal(blob.includes("[runtime] TRACE"), false);
  assert.equal(walkAttentionProjectConcept(view, "att-noordkaap"), null);
});

test("local owner and department assignment is visible in-session and lost after reset", () => {
  const view = homeView();
  const original = view.now.items.find((item) => item.id === "att-vraag");
  assert.equal(original?.ownerId, "emp-mira");
  assert.equal(original?.departmentId, "dep-reviewkring");

  const reassigned = reassignAttention({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    attentionId: "att-vraag",
    ownerId: "emp-reviewer",
    departmentId: "dep-koppelingen",
  });
  assert.equal(reassigned.ok, true);
  if (!reassigned.ok) return;

  const session1 = appendAttentionPatch(EMPTY_WORKBENCH_SESSION, reassigned.patch);
  const merged1 = mergeWorkbenchSession(view, session1);
  const patched = merged1.now.items.find((item) => item.id === "att-vraag");
  assert.equal(patched?.ownerId, "emp-reviewer");
  assert.equal(patched?.departmentId, "dep-koppelingen");
  assert.equal(
    filterInboxItems(merged1, { ownerId: "emp-reviewer", departmentId: "dep-koppelingen" }).some(
      (item) => item.id === "att-vraag",
    ),
    true,
  );

  const session2 = resetWorkbenchSession();
  const merged2 = mergeWorkbenchSession(view, session2);
  const restored = merged2.now.items.find((item) => item.id === "att-vraag");
  assert.equal(restored?.ownerId, "emp-mira");
  assert.equal(restored?.departmentId, "dep-reviewkring");
  assert.equal(assignmentsAreDurable(), false);
  assert.equal(session2.attentionPatches.length, 0);

  const projectChange = reassignProject({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: "prj-review-keten",
    ownerEmployeeId: "emp-reviewer",
    departmentId: "dep-koppelingen",
  });
  assert.equal(projectChange.ok, true);
  if (!projectChange.ok) return;
  const withProject = mergeWorkbenchSession(view, appendProjectPatch(EMPTY_WORKBENCH_SESSION, projectChange.patch));
  const project = withProject.projects.find((row) => row.project.id === "prj-review-keten");
  assert.equal(project?.project.departmentId, "dep-koppelingen");
  assert.ok(project?.team.some((member) => member.employee.id === "emp-reviewer" && member.role === "Eigenaar"));
  const fresh = mergeWorkbenchSession(view, resetWorkbenchSession());
  assert.equal(
    fresh.projects.find((row) => row.project.id === "prj-review-keten")?.project.departmentId,
    "dep-reviewkring",
  );

  const foreignAssign = reassignAttention({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    attentionId: "att-vraag",
    ownerId: "emp-lars",
  });
  assert.equal(foreignAssign.ok, false);
  if (!foreignAssign.ok) assert.equal(foreignAssign.reason, "tenant_denied");

  const unknownOwner = reassignAttention({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    attentionId: "att-vraag",
    ownerId: "emp-lars",
  });
  assert.equal(unknownOwner.ok, false);
  if (!unknownOwner.ok) assert.equal(unknownOwner.reason, "not_found");

  const seed = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(seed);
  assert.equal(seed.now.items.find((item) => item.id === "att-vraag")?.ownerId, "emp-mira");
});

test("publish stays DENY on the workbench after an approved review", () => {
  const view = homeView();
  for (const projectId of ["prj-review-keten", "prj-observatie-keten"]) {
    const opened = openProjectWorkbench({
      authenticated: true,
      actorTenantId: HOME_TENANT_ID,
      workspaceId: HOME_TENANT_ID,
      projectId,
      view,
    });
    assert.equal(opened.ok, true);
    if (!opened.ok) continue;
    assert.ok(opened.workbench.reviews.some((review) => review.state === "approved"));
    assert.ok(opened.workbench.publishes.length >= 1);
    for (const publish of opened.workbench.publishes) {
      assert.equal(publish.decision, "DENY");
      assert.equal(publish.visibleAfterApproved, true);
    }
    const review = opened.workbench.reviews[0];
    const attempt = tryPublish({
      authenticated: true,
      actorTenantId: HOME_TENANT_ID,
      workspaceId: HOME_TENANT_ID,
      reviewId: review?.id,
    });
    assert.equal(attempt.ok, false);
    assert.equal(attempt.decision, "DENY");
    assert.equal(attempt.visible, true);
  }
});

test("workbench sources stay synthetic: no persistence, media, or raw context", () => {
  const files = [
    readFileSync(join(ROOT, "pilot/p1-workbench.ts"), "utf8"),
    readFileSync(join(ROOT, "components/p1/p1-project-workbench.tsx"), "utf8"),
    readFileSync(join(ROOT, "components/p1/p1-inbox.tsx"), "utf8"),
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
  ]) {
    assert.equal(files.includes(needle), false, `P1.2 source leaked ${needle}`);
  }
  assert.match(files, /Publish: DENY|publish\.decision|DENY/);
  assert.match(files, /filterInboxItems|Status/);
});
