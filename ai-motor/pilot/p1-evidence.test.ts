import assert from "node:assert/strict";
import { test } from "node:test";
import { HOME_TENANT_ID, OTHER_TENANT_ID, serializeFoundationView } from "./p1-foundation.ts";
import { prepareTypedDraft } from "./p1-shell.ts";
import { mergeRosterSession, EMPTY_ROSTER_SESSION } from "./p1-roster.ts";
import {
  collectWorkspaceEvidence,
  evidenceRailLeaksContent,
  openEvidenceRail,
} from "./p1-evidence.ts";

const home = serializeFoundationView(HOME_TENANT_ID)!;

test("P1.5 evidence rail is tenant-scoped and content-free", () => {
  const opened = openEvidenceRail({
    authenticated: true,
    workspace: HOME_TENANT_ID,
    view: home,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.rail.tenantId, HOME_TENANT_ID);
  assert.ok(opened.rail.refs.length > 0);
  for (const ref of opened.rail.refs) {
    assert.ok(ref.id.length > 0);
    assert.ok(["reference", "digest", "receipt", "hash", "block"].includes(ref.kind));
  }
  const markers = home.projects.flatMap((row) => [
    row.project.goal,
    ...row.drafts.map((draft) => draft.title),
  ]).filter((marker): marker is string => typeof marker === "string" && marker.length > 8);
  assert.equal(evidenceRailLeaksContent(opened.rail, markers), false);
});

test("P1.5 other tenant cannot open the evidence rail", () => {
  const other = serializeFoundationView(OTHER_TENANT_ID)!;
  const opened = openEvidenceRail({
    authenticated: true,
    workspace: OTHER_TENANT_ID,
    view: other,
  });
  assert.equal(opened.ok, false);
  if (opened.ok) return;
  assert.equal(opened.reason, "tenant_denied");
  assert.equal(opened.rail, null);
});

test("P1.5 typed draft digest appears without body text", () => {
  const prepared = prepareTypedDraft({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: home.projects[0]!.project.id,
    title: "Geheim concept Wilgenhof intern",
    body: "echte reviewtekst mag nooit in de rail",
    nonce: "p15-rail",
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const merged = mergeRosterSession(home, {
    ...EMPTY_ROSTER_SESSION,
    overlay: {
      drafts: [prepared.draft],
      attention: [prepared.attention],
      departments: [],
      assignments: [],
    },
  });
  const rail = collectWorkspaceEvidence(merged);
  assert.ok(rail.refs.some((ref) => ref.digest === prepared.draft.bodyDigest));
  assert.equal(evidenceRailLeaksContent(rail, ["echte reviewtekst", "Wilgenhof intern"]), false);
});
