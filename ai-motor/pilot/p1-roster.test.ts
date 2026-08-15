/**
 * P1.3 Departments + Roster — acceptance tests (no browser, no live stack).
 *
 * 1. Configure a department within the home tenant
 * 2. Roster keeps Human vs AI concepts separate
 * 3. Assignments are in-memory, not durable
 * 4. Cross-tenant access fails closed
 * 5. Publish stays DENY
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  internalRuntimeAndModelLabels,
  serializeFoundationView,
} from "./p1-foundation.ts";
import {
  resolveMotorShell,
  tryPublish,
  viewContainsForeignTenant,
} from "./p1-shell.ts";
import {
  EMPTY_ROSTER_SESSION,
  appendDepartmentPatch,
  appendMembershipPatch,
  appendRosterOverlay,
  assignToDepartment,
  assignToProject,
  createDepartment,
  mergeRosterSession,
  openDepartmentWorkbench,
  resetRosterSession,
  resolveClientDepartmentId,
  resolveClientEmployeeId,
  rosterConcepts,
  rosterStateIsDurable,
  rosterWorkbenchEntries,
  splitRoster,
  updateDepartment,
} from "./p1-roster.ts";

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

test("department name, purpose and capabilities are configurable within the home tenant", () => {
  const view = homeView();
  const created = createDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    name: "Kennisring",
    purpose: "Gedeelde interne kennis, configureerbaar per team.",
    capabilities: ["knowledge.digest", "review.read"],
    nonce: "p13-dep-1",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.department.tenantId, HOME_TENANT_ID);
  assert.equal(created.department.name, "Kennisring");
  assert.deepEqual([...created.department.capabilities], ["knowledge.digest", "review.read"]);

  const withCreated = mergeRosterSession(
    view,
    appendRosterOverlay(EMPTY_ROSTER_SESSION, { departments: [created.department] }),
  );
  assert.ok(withCreated.departments.some((row) => row.id === created.department.id));
  assert.equal(
    withCreated.departments.find((row) => row.id === created.department.id)?.purpose,
    "Gedeelde interne kennis, configureerbaar per team.",
  );

  const updated = updateDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: "dep-reviewkring",
    name: "Reviewkring intern",
    purpose: "Hernieuwde review-capability, nog steeds configureerbaar.",
    capabilities: ["review.draft", "approval.queue", "evidence.attach"],
    view,
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;

  const merged = mergeRosterSession(view, appendDepartmentPatch(EMPTY_ROSTER_SESSION, updated.patch));
  const reviewkring = merged.departments.find((row) => row.id === "dep-reviewkring");
  assert.equal(reviewkring?.name, "Reviewkring intern");
  assert.equal(reviewkring?.purpose, "Hernieuwde review-capability, nog steeds configureerbaar.");
  assert.ok(reviewkring?.capabilities.includes("evidence.attach"));
  assert.equal(
    view.departments.find((row) => row.id === "dep-reviewkring")?.name,
    "Reviewkring",
  );

  const opened = openDepartmentWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: "dep-reviewkring",
    view: merged,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.workbench.department.name, "Reviewkring intern");
  assert.ok(opened.workbench.projects.some((project) => project.id === "prj-review-keten"));
  assert.ok(opened.workbench.members.some((member) => member.employee.id === "emp-mira"));

  const legacy = updateDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: "dep-reviewkring",
    name: "sales",
    view,
  });
  assert.equal(legacy.ok, false);
  if (!legacy.ok) assert.equal(legacy.reason, "legacy_taxonomy");

  const legacyCreate = createDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    name: "finance",
    purpose: "niet toegestaan",
    capabilities: ["x"],
  });
  assert.equal(legacyCreate.ok, false);
  if (!legacyCreate.ok) assert.equal(legacyCreate.reason, "legacy_taxonomy");
});

test("roster keeps Human and AI Employee concepts separate from Agent, Runtime and Model", () => {
  const view = homeView();
  const split = splitRoster(view);
  assert.ok(split.humans.length >= 1);
  assert.ok(split.ai.length >= 1);
  assert.ok(split.humans.every((row) => row.employee.kind === "human" && row.identity.kind === "human"));
  assert.ok(split.ai.every((row) => row.employee.kind === "ai" && row.identity.kind === "service"));
  assert.equal(
    split.humans.some((row) => row.employee.kind === "ai"),
    false,
  );
  assert.equal(
    split.ai.some((row) => row.employee.kind === "human"),
    false,
  );

  const human = split.humans.find((row) => row.employee.id === "emp-mira");
  const ai = split.ai.find((row) => row.employee.id === "emp-reviewer");
  assert.ok(human && ai);
  const humanConcepts = rosterConcepts(human);
  const aiConcepts = rosterConcepts(ai);
  assert.notEqual(humanConcepts.identityId, humanConcepts.employeeId);
  assert.notEqual(aiConcepts.identityId, aiConcepts.employeeId);
  assert.equal(humanConcepts.hasAgent, false);
  assert.equal(humanConcepts.hasRuntime, false);
  assert.equal(humanConcepts.hasModel, false);
  assert.equal(aiConcepts.hasAgent, false);
  assert.equal(aiConcepts.hasRuntime, false);
  assert.equal(aiConcepts.hasModel, false);
  assert.ok(human.employee.mandate.length > 0);
  assert.ok(ai.employee.capabilities.length > 0);
  assert.ok(human.assignments.some((row) => row.projectId === "prj-review-keten"));
  assert.ok(ai.assignments.some((row) => row.projectId === "prj-review-keten"));

  const ids = view.roster.map((row) => row.employee.id);
  assert.equal(ids.includes("agent-reviewer-binding"), false);
  assert.equal(ids.includes("rt-local-worker"), false);
  assert.equal(ids.includes("mdl-demo-weights"), false);

  const blob = JSON.stringify({ split, entries: rosterWorkbenchEntries(view) });
  for (const label of internalRuntimeAndModelLabels(HOME_TENANT_ID)) {
    assert.equal(blob.includes(label), false, `roster leaked ${label}`);
  }
  assert.equal(blob.includes("agent-reviewer-binding"), false);
});

test("employee, department and project assignment is visible in-session and lost after reset", () => {
  const view = homeView();
  const created = createDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    name: "Observatiekring",
    purpose: "Tijdelijke lokale kring.",
    capabilities: ["observe.local"],
    nonce: "p13-dep-2",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const membership = assignToDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    employeeId: "emp-mira",
    departmentId: created.department.id,
    role: "Kringlid",
    view: mergeRosterSession(
      view,
      appendRosterOverlay(EMPTY_ROSTER_SESSION, { departments: [created.department] }),
    ),
  });
  assert.equal(membership.ok, true);
  if (!membership.ok) return;

  const projectAssign = assignToProject({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    employeeId: "emp-reviewer",
    projectId: "prj-review-keten",
    role: "Tweede lezer",
    nonce: "p13-asg-1",
  });
  assert.equal(projectAssign.ok, true);
  if (!projectAssign.ok) return;

  const session = appendMembershipPatch(
    appendRosterOverlay(EMPTY_ROSTER_SESSION, {
      departments: [created.department],
      assignments: [projectAssign.assignment],
    }),
    membership.patch,
  );
  const merged = mergeRosterSession(view, session);
  assert.ok(merged.departments.some((row) => row.id === created.department.id));
  const mira = rosterWorkbenchEntries(merged, session).find((row) => row.employee.id === "emp-mira");
  assert.ok(mira?.departments.some((link) => link.departmentId === created.department.id && link.role === "Kringlid"));
  const reviewer = merged.roster.find((row) => row.employee.id === "emp-reviewer");
  assert.ok(reviewer?.assignments.some((row) => row.role === "Tweede lezer"));

  const opened = openDepartmentWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: created.department.id,
    view: merged,
    session,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.ok(opened.workbench.members.some((member) => member.employee.id === "emp-mira" && member.role === "Kringlid"));

  const reset = resetRosterSession();
  const restored = mergeRosterSession(view, reset);
  assert.equal(
    restored.departments.some((row) => row.id === created.department.id),
    false,
  );
  const miraRestored = rosterWorkbenchEntries(restored, reset).find((row) => row.employee.id === "emp-mira");
  assert.equal(
    miraRestored?.departments.some((link) => link.departmentId === created.department.id),
    false,
  );
  const reviewerRestored = restored.roster.find((row) => row.employee.id === "emp-reviewer");
  assert.equal(
    reviewerRestored?.assignments.some((row) => row.role === "Tweede lezer"),
    false,
  );
  assert.equal(rosterStateIsDurable(), false);
  assert.equal(reset.departmentPatches.length, 0);
  assert.equal(reset.membershipPatches.length, 0);
  assert.equal(reset.overlay.assignments.length, 0);

  const seed = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(seed);
  assert.equal(seed.departments.some((row) => row.name === "Observatiekring"), false);
  assert.equal(
    seed.roster.find((row) => row.employee.id === "emp-reviewer")?.assignments.some((row) => row.role === "Tweede lezer"),
    false,
  );
});

test("foreign tenant stays invisible via route, query or client-state", () => {
  const attacks: Parameters<typeof resolveMotorShell>[0][] = [
    { authenticated: true, requested: { workspace: OTHER_TENANT_ID } },
    { authenticated: true, requested: { pathSegments: [OTHER_TENANT_ID] } },
    { authenticated: true, requested: { query: { workspace: OTHER_TENANT_ID } } },
    { authenticated: true, requested: { query: { tenant: OTHER_TENANT_ID, department: "dep-noord-archief" } } },
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
  assert.equal(resolveClientDepartmentId(view, "dep-noord-archief"), null);
  assert.equal(resolveClientDepartmentId(view, OTHER_TENANT_ID), null);
  assert.equal(resolveClientEmployeeId(view, "emp-lars"), null);
  assert.equal(resolveClientEmployeeId(view, OTHER_TENANT_ID), null);
  assert.equal(viewContainsForeignTenant(view), false);
  assert.equal(splitRoster(view).humans.some((row) => row.employee.id === "emp-lars"), false);

  const foreignDept = openDepartmentWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: "dep-noord-archief",
  });
  assert.equal(foreignDept.ok, false);
  assert.equal(foreignDept.workbench, null);
  assert.equal(JSON.stringify(foreignDept).includes("Noordkaap"), false);

  const otherWorkspace = openDepartmentWorkbench({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    departmentId: "dep-noord-archief",
  });
  assert.equal(otherWorkspace.ok, false);
  if (!otherWorkspace.ok) assert.equal(otherWorkspace.reason, "tenant_denied");

  const foreignUpdate = updateDepartment({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    departmentId: "dep-noord-archief",
    name: "Archiefkring",
  });
  assert.equal(foreignUpdate.ok, false);
  if (!foreignUpdate.ok) assert.equal(foreignUpdate.reason, "tenant_denied");

  const foreignMember = assignToDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    employeeId: "emp-lars",
    departmentId: "dep-reviewkring",
    role: "Archivaris",
  });
  assert.equal(foreignMember.ok, false);
  if (!foreignMember.ok) assert.equal(foreignMember.reason, "not_found");

  const foreignAssign = assignToProject({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    employeeId: "emp-lars",
    projectId: "prj-noordkaap-geheim",
    role: "Archivaris",
  });
  assert.equal(foreignAssign.ok, false);
  if (!foreignAssign.ok) assert.equal(foreignAssign.reason, "tenant_denied");

  const unauthenticated = openDepartmentWorkbench({
    authenticated: false,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: "dep-reviewkring",
  });
  assert.equal(unauthenticated.ok, false);
  if (!unauthenticated.ok) assert.equal(unauthenticated.reason, "auth_required");
});

test("publish stays DENY on the department workbench after an approved review", () => {
  const view = homeView();
  const opened = openDepartmentWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    departmentId: "dep-reviewkring",
    view,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.ok(opened.workbench.publishes.length >= 1);
  for (const publish of opened.workbench.publishes) {
    assert.equal(publish.decision, "DENY");
    assert.equal(publish.visibleAfterApproved, true);
  }

  const attempt = tryPublish({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    reviewId: view.projects[0]?.reviews[0]?.id,
  });
  assert.equal(attempt.ok, false);
  assert.equal(attempt.decision, "DENY");
  assert.equal(attempt.visible, true);
  assert.equal(attempt.reason, "publish_denied");
});

test("roster sources stay synthetic: no persistence, media, or raw context", () => {
  const files = [
    readFileSync(join(ROOT, "pilot/p1-roster.ts"), "utf8"),
    readFileSync(join(ROOT, "components/p1/p1-departments.tsx"), "utf8"),
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
    assert.equal(files.includes(needle), false, `P1.3 source leaked ${needle}`);
  }
  assert.match(files, /Publish: DENY|publish\.decision|DENY/);
  assert.match(files, /Human|Mens/);
  assert.match(files, /AI Employee/);
});
