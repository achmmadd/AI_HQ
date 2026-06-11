import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkspaceScope } from "@/lib/auth-session";
import { isScopedOperator } from "@/lib/auth-guards";

/** Mirror of requireWorkspaceApi scope check (auth-guards.ts). */
function workspaceScopeAllows(
  sessionScope: WorkspaceScope,
  target: WorkspaceScope
): boolean {
  return sessionScope === "all" || sessionScope === target;
}

describe("workspaceScopeAllows (apps/fumero API guard)", () => {
  it("allows fumero operators on fumero-target routes", () => {
    assert.equal(workspaceScopeAllows("fumero", "fumero"), true);
  });

  it("allows admin/all operators on fumero-target routes", () => {
    assert.equal(workspaceScopeAllows("all", "fumero"), true);
  });

  it("rejects bokas and personal scopes on fumero-target routes", () => {
    assert.equal(workspaceScopeAllows("bokas", "fumero"), false);
    assert.equal(workspaceScopeAllows("personal", "fumero"), false);
  });

  it("documents old apps bug: fumero operators blocked on all-only target", () => {
    assert.equal(workspaceScopeAllows("fumero", "all"), false);
  });
});

describe("isScopedOperator (apps build/garage guard, requireScopedWorkspaceApi)", () => {
  it("allows fumero operators to start/poll builds for their own workspace", () => {
    assert.equal(isScopedOperator("fumero"), true);
  });

  it("allows bokas operators to start/poll builds for their own workspace", () => {
    assert.equal(isScopedOperator("bokas"), true);
  });

  it("allows admin/all operators", () => {
    assert.equal(isScopedOperator("all"), true);
  });

  it("rejects personal scope (no tenant workspace)", () => {
    assert.equal(isScopedOperator("personal"), false);
  });
});
