/**
 * P1 Product Foundation — read-model tests (no browser, no live stack).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  FORBIDDEN_VIEW_MARKERS,
  HOME_TENANT_ID,
  LEGACY_DEPARTMENT_TAXONOMY,
  OTHER_TENANT_ID,
  PRIMARY_NAV,
  departmentNames,
  evidenceDisplayValue,
  internalRuntimeAndModelLabels,
  isBlockExecutable,
  nowInbox,
  peekInternalHidden,
  serializeFoundationView,
  tryMutateTenant,
  walkNowProjectDepartment,
} from "./p1-foundation.ts";

test("Nu → Project → Afdeling works with synthetic home-tenant data", () => {
  const walked = walkNowProjectDepartment(HOME_TENANT_ID);
  assert.ok(walked, "home tenant must expose Nu → Project → Afdeling");
  assert.equal(walked.item.tenantId, HOME_TENANT_ID);
  assert.equal(walked.project.tenantId, HOME_TENANT_ID);
  assert.equal(walked.department.tenantId, HOME_TENANT_ID);
  assert.equal(walked.project.id, walked.item.projectId);
  assert.equal(walked.department.id, walked.project.departmentId);

  const now = nowInbox(HOME_TENANT_ID);
  assert.ok(now);
  assert.deepEqual([...now.stages], ["vraag", "actief", "jij_nodig", "klaar"]);
  for (const stage of now.stages) {
    assert.ok(
      now.items.some((item) => item.stage === stage),
      `attention stage ${stage} must have at least one item`,
    );
  }
  assert.ok(now.items.some((item) => item.kind === "approval"));
  assert.ok(now.items.some((item) => item.kind === "failure"));
  assert.ok(now.items.some((item) => item.kind === "outcome"));
});

test("primary nav is Nu / Projecten / Afdelingen without runtime or model names", () => {
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  assert.deepEqual(
    view.nav.map((item) => item.label),
    ["Nu", "Projecten", "Afdelingen"],
  );
  const navBlob = JSON.stringify(view.nav).toLowerCase();
  for (const label of internalRuntimeAndModelLabels(HOME_TENANT_ID)) {
    assert.equal(navBlob.includes(label.toLowerCase()), false, `nav leaked ${label}`);
  }
  assert.deepEqual(PRIMARY_NAV.map((item) => item.id), ["now", "projects", "departments"]);
});

test("other synthetic organisation is neither visible nor mutable", () => {
  const home = serializeFoundationView(HOME_TENANT_ID);
  const other = serializeFoundationView(OTHER_TENANT_ID);
  assert.ok(home);
  assert.ok(other);
  const homeBlob = JSON.stringify(home);
  assert.equal(home.tenantId, HOME_TENANT_ID);
  assert.equal(other.tenantId, OTHER_TENANT_ID);
  assert.notEqual(home.organizationName, other.organizationName);
  assert.equal(homeBlob.includes(other.organizationName), false);
  assert.equal(homeBlob.includes("Noordkaap"), false);
  assert.equal(homeBlob.includes("prj-noordkaap-geheim"), false);
  assert.equal(home.projects.some((row) => row.project.tenantId !== HOME_TENANT_ID), false);
  assert.equal(tryMutateTenant(HOME_TENANT_ID, OTHER_TENANT_ID).reason, "tenant_denied");
  assert.equal(tryMutateTenant(OTHER_TENANT_ID, HOME_TENANT_ID).reason, "tenant_denied");
  assert.equal(tryMutateTenant(HOME_TENANT_ID, HOME_TENANT_ID).reason, "read_only");
  assert.equal(serializeFoundationView("ws-unknown"), null);
  assert.equal(tryMutateTenant("ws-unknown", HOME_TENANT_ID).reason, "unknown_tenant");
});

test("departments are configurable capabilities, not a hardcoded legacy taxonomy", () => {
  const names = departmentNames(HOME_TENANT_ID);
  assert.ok(names.length >= 2);
  const legacy = new Set(LEGACY_DEPARTMENT_TAXONOMY);
  assert.equal(
    names.every((name) => legacy.has(name)) && names.length === legacy.size,
    false,
    "must not be the legacy CRM taxonomy",
  );
  for (const name of names) {
    assert.equal(legacy.has(name), false, `legacy taxonomy name leaked: ${name}`);
  }
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  for (const department of view.departments) {
    assert.ok(department.capabilities.length > 0);
    assert.ok(department.purpose.length > 0);
  }
});

test("serialized view-models contain no secrets, context bodies or raw runtime logs", () => {
  const hidden = peekInternalHidden(HOME_TENANT_ID);
  assert.ok(hidden);
  assert.equal(hidden.secret, FORBIDDEN_VIEW_MARKERS.secret);
  assert.equal(hidden.contextBody, FORBIDDEN_VIEW_MARKERS.contextBody);
  assert.equal(hidden.rawRuntimeLog, FORBIDDEN_VIEW_MARKERS.rawRuntimeLog);

  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  const blob = JSON.stringify(view);
  for (const marker of Object.values(FORBIDDEN_VIEW_MARKERS)) {
    assert.equal(blob.includes(marker), false, `view leaked ${marker}`);
  }
  assert.equal(blob.includes("FULL_CONTEXT_BODY"), false);
  assert.equal(blob.includes("[runtime] TRACE"), false);
  assert.equal(blob.includes("sk-live"), false);
  for (const label of internalRuntimeAndModelLabels(HOME_TENANT_ID)) {
    assert.equal(blob.includes(label), false, `view leaked runtime/model ${label}`);
  }
  for (const project of view.projects) {
    assert.ok(project.project.context.digest.startsWith("sha256:"));
    assert.equal("content" in project.project.context, false);
    assert.equal("body" in project.project.context, false);
  }
  assert.equal(evidenceDisplayValue(null), "—");
});

test("draft, review and publish are separate objects and publish stays DENY after approval", () => {
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  const project = view.projects[0];
  assert.ok(project);
  const [draft] = project.drafts;
  const [review] = project.reviews;
  const [publish] = project.publishes;
  assert.ok(draft && review && publish);
  assert.equal(draft.kind, "draft");
  assert.equal(review.kind, "review");
  assert.equal(publish.kind, "publish");
  assert.notEqual(draft.id, review.id);
  assert.notEqual(review.id, publish.id);
  assert.notEqual(draft.id, publish.id);
  assert.equal(review.draftId, draft.id);
  assert.equal(publish.reviewId, review.id);
  assert.equal(review.state, "approved");
  assert.equal(publish.decision, "DENY");
  assert.equal(publish.visibleAfterApproved, true);
  assert.match(publish.reason, /DENY/);
});

test("roster keeps Identity, Employee, Task, Run, Attempt, Agent, Runtime and Model distinct", () => {
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  const human = view.roster.find((row) => row.employee.kind === "human");
  const ai = view.roster.find((row) => row.employee.kind === "ai");
  assert.ok(human && ai);
  assert.equal(human.identity.kind, "human");
  assert.equal(ai.identity.kind, "service");
  assert.notEqual(human.identity.id, human.employee.id);
  assert.notEqual(ai.identity.id, ai.employee.id);
  assert.equal("runtimeId" in human.employee, false);
  assert.equal("modelId" in ai.employee, false);
  assert.ok(human.assignments.length > 0);
  assert.ok(ai.assignments.length > 0);

  const project = view.projects[0];
  assert.ok(project);
  const task = project.tasks[0];
  assert.ok(task);
  const item = view.now.items.find((row) => row.references.runId && row.references.attemptId);
  assert.ok(item);
  assert.notEqual(task.id, item.references.runId);
  assert.notEqual(item.references.runId, item.references.attemptId);
  assert.notEqual(task.employeeId, item.references.runId);
});

test("BlockManifest is typed composition data and is not executable", () => {
  const view = serializeFoundationView(HOME_TENANT_ID);
  assert.ok(view);
  assert.ok(view.blocks.length >= 1);
  for (const block of view.blocks) {
    assert.ok(Array.isArray(block.schema) && block.schema.length > 0);
    assert.ok(Array.isArray(block.scopes) && block.scopes.length > 0);
    assert.ok(Array.isArray(block.effects));
    assert.ok(block.risk === "low" || block.risk === "medium" || block.risk === "high");
    assert.ok(block.evidence.digest.startsWith("sha256:"));
    assert.equal("execute" in block, false);
    assert.equal("invoke" in block, false);
    assert.equal("run" in block, false);
    assert.equal(typeof (block as { execute?: unknown }).execute, "undefined");
    assert.equal(typeof (block as { invoke?: unknown }).invoke, "undefined");
    assert.equal(isBlockExecutable(block), false);
    assert.equal(typeof block, "object");
    assert.equal(Object.isFrozen(block), true);
  }
});
