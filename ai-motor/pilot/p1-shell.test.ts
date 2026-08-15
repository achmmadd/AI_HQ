/**
 * P1.1 Motor shell — acceptance tests (no browser, no live stack).
 *
 * 1. Home tenant only
 * 2. Other org unreadable via route/query manipulation
 * 3. Nu → Project → concept → reviewstatus
 * 4. Typed item is draft-only
 * 5. All publish paths DENY
 * 6. Departments and assignments configurable within tenant
 * 7. Missing/invalid workspace or auth fail closed
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  serializeFoundationView,
} from "./p1-foundation.ts";
import {
  INPUT_ZONE,
  activateInput,
  allPublishDecisions,
  assignEmployee,
  collectRequestedWorkspaces,
  configureDepartment,
  mergeShellOverlay,
  prepareTypedDraft,
  resolveMotorShell,
  tryPublish,
  viewContainsForeignTenant,
  walkNowProjectConceptReview,
} from "./p1-shell.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function homeProjectId(): string {
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  return view.projects[0]!.project.id;
}

function homeEmployeeId(): string {
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  return view.roster[0]!.employee.id;
}

test("1. a user only sees ws-motor data", () => {
  const access = resolveMotorShell({
    authenticated: true,
    requested: { workspace: HOME_TENANT_ID },
  });
  assert.equal(access.ok, true);
  if (!access.ok) return;
  assert.equal(access.tenantId, HOME_TENANT_ID);
  assert.equal(access.view.tenantId, HOME_TENANT_ID);
  assert.equal(viewContainsForeignTenant(access.view), false);
  assert.equal(JSON.stringify(access.view).includes("ws-anders"), false);
  assert.equal(JSON.stringify(access.view).includes("Noordkaap"), false);
  for (const project of access.view.projects) {
    assert.equal(project.project.tenantId, HOME_TENANT_ID);
  }
  for (const department of access.view.departments) {
    assert.equal(department.tenantId, HOME_TENANT_ID);
  }
});

test("2. the other synthetic organisation is unreadable via route or query manipulation", () => {
  const attacks: Parameters<typeof resolveMotorShell>[0][] = [
    { authenticated: true, requested: { workspace: OTHER_TENANT_ID } },
    { authenticated: true, requested: { tenant: OTHER_TENANT_ID } },
    { authenticated: true, requested: { pathSegments: [OTHER_TENANT_ID] } },
    { authenticated: true, requested: { query: { workspace: OTHER_TENANT_ID } } },
    { authenticated: true, requested: { query: { tenant: OTHER_TENANT_ID } } },
    { authenticated: true, requested: { query: { workspace_id: OTHER_TENANT_ID } } },
    { authenticated: true, requested: { query: { tenantId: ["ws-anders"] } } },
    {
      authenticated: true,
      requested: { workspace: HOME_TENANT_ID, query: { workspace: OTHER_TENANT_ID } },
    },
    {
      authenticated: true,
      requested: { pathSegments: [HOME_TENANT_ID], query: { tenant: OTHER_TENANT_ID } },
    },
  ];

  for (const attack of attacks) {
    const access = resolveMotorShell(attack);
    assert.equal(access.ok, false, `attack should fail: ${JSON.stringify(attack.requested)}`);
    if (access.ok) continue;
    assert.equal(access.view, null);
    assert.equal(access.reason, "tenant_denied");
    assert.equal(JSON.stringify(access).includes("Noordkaap"), false);
    assert.equal(JSON.stringify(access).includes("prj-noordkaap-geheim"), false);
  }

  const collected = collectRequestedWorkspaces({
    pathSegments: ["ws-anders"],
    query: { workspace: "ws-motor" },
  });
  assert.ok(collected.includes(OTHER_TENANT_ID));
});

test("3. Nu → Project → concept → reviewstatus is a navigable flow", () => {
  const access = resolveMotorShell({
    authenticated: true,
    requested: { workspace: HOME_TENANT_ID },
  });
  assert.equal(access.ok, true);
  if (!access.ok) return;

  const walked = walkNowProjectConceptReview(access.view);
  assert.ok(walked, "Nu must resolve a project with concepts and review status");
  assert.equal(walked.item.tenantId, HOME_TENANT_ID);
  assert.equal(walked.project.tenantId, HOME_TENANT_ID);
  assert.equal(walked.project.id, walked.item.projectId);
  assert.ok(walked.concepts.length >= 1);
  assert.equal(walked.concepts[0]?.kind, "draft");
  assert.equal(walked.review?.kind, "review");
  assert.equal(walked.review?.state, "approved");
  assert.equal(walked.publish?.kind, "publish");
  assert.equal(walked.publish?.decision, "DENY");

  assert.deepEqual(
    access.view.nav.map((item) => item.label),
    ["Nu", "Projecten", "Afdelingen"],
  );
});

test("4. a newly typed item is exclusively a draft and cannot publish", () => {
  const prepared = prepareTypedDraft({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: homeProjectId(),
    title: "Interne notitie over de review-vraag",
    body: "Alleen lokaal concept.",
    nonce: "typed-1",
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.draft.kind, "draft");
  assert.equal(prepared.draft.state, "draft");
  assert.equal(prepared.draft.origin, "typed");
  assert.equal(prepared.draft.tenantId, HOME_TENANT_ID);
  assert.equal("publish" in prepared.draft, false);
  assert.equal("decision" in prepared.draft, false);

  const home = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(home);
  const merged = mergeShellOverlay(home, {
    drafts: [prepared.draft],
    attention: [prepared.attention],
    departments: [],
    assignments: [],
  });
  const project = merged.projects.find((row) => row.project.id === prepared.draft.projectId);
  assert.ok(project);
  assert.ok(project.drafts.some((draft) => draft.id === prepared.draft.id && draft.state === "draft"));
  assert.equal(
    project.publishes.some((publish) => publish.id === prepared.draft.id),
    false,
  );

  const publish = tryPublish({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    draftId: prepared.draft.id,
  });
  assert.equal(publish.ok, false);
  assert.equal(publish.decision, "DENY");
  assert.equal(publish.reason, "publish_denied");
});

test("5. every publish path is DENY, including after approved review", () => {
  const access = resolveMotorShell({
    authenticated: true,
    requested: { workspace: HOME_TENANT_ID },
  });
  assert.equal(access.ok, true);
  if (!access.ok) return;

  const publishes = allPublishDecisions(access.view);
  assert.ok(publishes.length >= 1);
  for (const publish of publishes) {
    assert.equal(publish.decision, "DENY");
    assert.equal(publish.visibleAfterApproved, true);
    assert.equal(publish.kind, "publish");
  }

  const review = access.view.projects[0]?.reviews[0];
  assert.equal(review?.state, "approved");
  const afterApproved = tryPublish({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    reviewId: review?.id,
  });
  assert.equal(afterApproved.ok, false);
  assert.equal(afterApproved.decision, "DENY");
  assert.equal(afterApproved.visible, true);

  const foreign = tryPublish({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
  });
  assert.equal(foreign.ok, false);
  assert.equal(foreign.decision, "DENY");
  assert.equal(foreign.reason, "tenant_denied");
});

test("6. departments and employee assignments are configurable within the tenant", () => {
  const department = configureDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    name: "Kennisring",
    purpose: "Gedeelde interne kennis, configureerbaar per team.",
    capabilities: ["knowledge.digest", "review.read"],
    nonce: "dep-1",
  });
  assert.equal(department.ok, true);
  if (!department.ok) return;
  assert.equal(department.department.tenantId, HOME_TENANT_ID);
  assert.equal(department.department.name, "Kennisring");
  assert.ok(department.department.capabilities.length >= 1);

  const legacy = configureDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    name: "sales",
    purpose: "niet toegestaan",
    capabilities: ["x"],
  });
  assert.equal(legacy.ok, false);
  if (!legacy.ok) assert.equal(legacy.reason, "legacy_taxonomy");

  const assignment = assignEmployee({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    employeeId: homeEmployeeId(),
    projectId: homeProjectId(),
    role: "Meekijker",
    nonce: "asg-1",
  });
  assert.equal(assignment.ok, true);
  if (!assignment.ok) return;
  assert.equal(assignment.assignment.tenantId, HOME_TENANT_ID);

  const foreignDept = configureDepartment({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    name: "Archiefkring",
    purpose: "mag niet",
    capabilities: ["archive.read"],
  });
  assert.equal(foreignDept.ok, false);
  if (!foreignDept.ok) assert.equal(foreignDept.reason, "tenant_denied");

  const foreignAssign = assignEmployee({
    authenticated: true,
    actorTenantId: OTHER_TENANT_ID,
    workspaceId: OTHER_TENANT_ID,
    employeeId: "emp-lars",
    projectId: "prj-noordkaap-geheim",
    role: "Archivaris",
  });
  assert.equal(foreignAssign.ok, false);
  if (!foreignAssign.ok) assert.equal(foreignAssign.reason, "tenant_denied");

  const home = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(home);
  const merged = mergeShellOverlay(home, {
    drafts: [],
    attention: [],
    departments: [department.department],
    assignments: [assignment.assignment],
  });
  assert.ok(merged.departments.some((row) => row.id === department.department.id));
  assert.equal(JSON.stringify(merged).includes("Noordkaap"), false);
  const roster = merged.roster.find((row) => row.employee.id === assignment.assignment.employeeId);
  assert.ok(roster?.assignments.some((row) => row.role === "Meekijker"));
});

test("7. missing or invalid workspace or auth fails closed", () => {
  const unauthenticated = resolveMotorShell({
    authenticated: false,
    requested: { workspace: HOME_TENANT_ID },
  });
  assert.equal(unauthenticated.ok, false);
  if (!unauthenticated.ok) {
    assert.equal(unauthenticated.reason, "auth_required");
    assert.equal(unauthenticated.view, null);
  }

  const missing = resolveMotorShell({ authenticated: true });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.reason, "workspace_required");
    assert.equal(missing.view, null);
  }

  const empty = resolveMotorShell({
    authenticated: true,
    requested: { workspace: "   ", query: { tenant: "" } },
  });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.reason, "workspace_required");

  const unknown = resolveMotorShell({
    authenticated: true,
    requested: { pathSegments: ["ws-onbekend"] },
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.reason, "unknown_workspace");
    assert.equal(unknown.view, null);
    assert.equal(JSON.stringify(unknown).includes("Noordkaap"), false);
  }

  const typedWithoutAuth = prepareTypedDraft({
    authenticated: false,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: homeProjectId(),
    title: "mag niet",
  });
  assert.equal(typedWithoutAuth.ok, false);
  if (!typedWithoutAuth.ok) assert.equal(typedWithoutAuth.reason, "auth_required");

  const defaulted = resolveMotorShell({ authenticated: true, defaultHomeWorkspace: true });
  assert.equal(defaulted.ok, true);
  if (defaulted.ok) assert.equal(defaulted.tenantId, HOME_TENANT_ID);
});

test("input zone: Typen may draft; Spreken, Bellen and Bestand stay disabled placeholders", () => {
  assert.deepEqual(
    INPUT_ZONE.map((item) => [item.label, item.enabled]),
    [
      ["Typen", true],
      ["Spreken", false],
      ["Bellen", false],
      ["Bestand", false],
    ],
  );
  assert.equal(activateInput("type").ok, true);
  assert.equal(activateInput("speak").ok, false);
  assert.equal(activateInput("call").ok, false);
  assert.equal(activateInput("file").ok, false);

  const shell = readFileSync(join(ROOT, "components/p1/p1-foundation-shell.tsx"), "utf8");
  const inputZone = readFileSync(join(ROOT, "components/p1/p1-input-zone.tsx"), "utf8");
  const pages = [
    readFileSync(join(ROOT, "app/motor/page.tsx"), "utf8"),
    readFileSync(join(ROOT, "app/motor/[workspace]/page.tsx"), "utf8"),
    readFileSync(join(ROOT, "app/motor/render-motor-shell.tsx"), "utf8"),
  ].join("\n");
  const blob = `${shell}\n${inputZone}\n${pages}`;
  for (const needle of [
    "getUserMedia",
    "mediaDevices",
    "MediaRecorder",
    'type="file"',
    "type='file'",
    "tel:",
    "RTCPeerConnection",
    "webkitGetUserMedia",
  ]) {
    assert.equal(blob.includes(needle), false, `P1.1 UI leaked capability ${needle}`);
  }
});
