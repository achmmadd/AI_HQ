/**
 * ADR-110 proof — Context Contract tests (acceptance criterion 2).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  bindManifest,
  buildContextManifest,
  manifestSemanticsEqual,
  validateContextItem,
  validateManifest,
} from "./context.ts";
import { digestOf, isSha256Digest } from "./digest.ts";
import {
  buildProofFixture,
  makeContextItem,
  PROOF_WORKSPACE_ID,
  T0,
  T1,
} from "./scenario.ts";
import type { AttemptId, ContextItem, ContextManifest, RunId } from "./types.ts";
import { branded, isoTimestamp } from "./types.ts";

describe("validateContextItem", () => {
  const fixture = buildProofFixture();

  it("accepts a well-formed item with provenance, scope and digest", () => {
    for (const item of fixture.items) {
      const result = validateContextItem(item);
      assert.equal(result.ok, true, JSON.stringify(result));
    }
  });

  it("rejects a tampered payload (digest no longer recomputes)", () => {
    const original = fixture.items[0];
    const tampered: ContextItem = {
      ...original,
      payload: { title: "forged", review_id: 42, rating: 5 },
    };
    const result = validateContextItem(tampered);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes("recompute")));
  });

  it("rejects a malformed digest", () => {
    const original = fixture.items[0];
    const broken: ContextItem = { ...original, digest: branded("sha256:zz") };
    const result = validateContextItem(broken);
    assert.equal(result.ok, false);
  });

  it("rejects an unknown kind", () => {
    const original = fixture.items[0];
    const broken = {
      ...original,
      kind: "memory-dump",
      payload: original.payload,
    } as unknown as ContextItem;
    // digest still matches payload, so only the kind check can fail
    const result = validateContextItem(broken);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes("kind")));
  });

  it("rejects missing provenance", () => {
    const original = fixture.items[0];
    const broken: ContextItem = {
      ...original,
      provenance: { produced_by: "", source: "" },
    };
    const result = validateContextItem(broken);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes("provenance")));
  });
});

describe("buildContextManifest", () => {
  const fixture = buildProofFixture();
  const baseInput = {
    task: fixture.task,
    run_id: branded<RunId>("run-m1"),
    attempt_id: branded<AttemptId>("att-m1"),
    policy: {
      policy_id: fixture.policy.policy_id,
      version: fixture.policy.version,
      digest: fixture.policy.digest,
    },
    now: fixture.now,
  } as const;

  it("builds an immutable, total-digested manifest that validates", () => {
    const built = buildContextManifest({ ...baseInput, items: fixture.items });
    assert.equal(built.ok, true, JSON.stringify(built));
    if (!built.ok) return;
    assert.ok(isSha256Digest(built.manifest.total_digest));
    assert.ok(Object.isFrozen(built.manifest));
    assert.ok(Object.isFrozen(built.manifest.items));
    assert.equal(validateManifest(built.manifest, fixture.now).ok, true);
    // total digest is defined over the ordered item digests
    assert.equal(
      built.manifest.total_digest,
      digestOf(fixture.items.map((i) => i.digest)),
    );
  });

  it("REJECTS cross-workspace context", () => {
    const built = buildContextManifest({
      ...baseInput,
      items: [...fixture.items, fixture.cross_workspace_item],
    });
    assert.equal(built.ok, false);
    assert.ok(
      !built.ok && built.errors.some((e) => e.includes("cross-workspace")),
    );
  });

  it("rejects expired items", () => {
    const built = buildContextManifest({
      ...baseInput,
      items: [...fixture.items, fixture.expired_item],
    });
    assert.equal(built.ok, false);
    assert.ok(!built.ok && built.errors.some((e) => e.includes("expired")));
  });

  it("rejects items whose scope points at a different task", () => {
    const foreign = makeContextItem({
      item_id: "ctx-other-task",
      kind: "task",
      data_class: "internal",
      scope: {
        type: "task",
        workspace_id: PROOF_WORKSPACE_ID,
        task_id: branded("task-other"),
      },
      payload: { title: "another task" },
      created_at: T0,
    });
    const built = buildContextManifest({
      ...baseInput,
      items: [...fixture.items, foreign],
    });
    assert.equal(built.ok, false);
    assert.ok(!built.ok && built.errors.some((e) => e.includes("task scope")));
  });

  it("rejects redacted items still present in the manifest", () => {
    const built = buildContextManifest({
      ...baseInput,
      items: fixture.items,
      redacted: [{ item_id: fixture.items[0].item_id, reason: "private" }],
    });
    assert.equal(built.ok, false);
    assert.ok(!built.ok && built.errors.some((e) => e.includes("redacted")));
  });
});

describe("validateManifest tamper detection", () => {
  const fixture = buildProofFixture();
  const built = buildContextManifest({
    task: fixture.task,
    run_id: branded("run-t1"),
    attempt_id: branded("att-t1"),
    items: fixture.items,
    policy: {
      policy_id: fixture.policy.policy_id,
      version: fixture.policy.version,
      digest: fixture.policy.digest,
    },
    now: fixture.now,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error("unreachable");
  const manifest = built.manifest;

  it("fails when an item digest is tampered with", () => {
    const forged: ContextManifest = {
      ...manifest,
      items: [
        { ...manifest.items[0], digest: digestOf("forged") },
        ...manifest.items.slice(1),
      ],
    };
    const result = validateManifest(forged, fixture.now);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes("total digest")));
  });

  it("fails when the item order is changed", () => {
    const reordered: ContextManifest = {
      ...manifest,
      items: [manifest.items[1], manifest.items[0], manifest.items[2]],
    };
    const result = validateManifest(reordered, fixture.now);
    assert.equal(result.ok, false);
  });

  it("fails when the manifest is expired", () => {
    const expired: ContextManifest = {
      ...manifest,
      expires_at: isoTimestamp("2026-08-13T00:00:00.000Z"),
    };
    const result = validateManifest(expired, fixture.now);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((e) => e.includes("expired")));
  });
});

describe("bindManifest — exactly one manifest per Attempt", () => {
  const fixture = buildProofFixture();
  const make = (attempt: string) => {
    const built = buildContextManifest({
      task: fixture.task,
      run_id: branded(`run-${attempt}`),
      attempt_id: branded(attempt),
      items: fixture.items,
      policy: {
        policy_id: fixture.policy.policy_id,
        version: fixture.policy.version,
        digest: fixture.policy.digest,
      },
      now: fixture.now,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error("unreachable");
    return built.manifest;
  };

  it("binds the first manifest and rejects any second bind for the attempt", () => {
    const first = make("att-once");
    const second = make("att-once");
    const bound1 = bindManifest(new Map(), first);
    assert.equal(bound1.ok, true);
    if (!bound1.ok) return;
    const bound2 = bindManifest(bound1.bound, second);
    assert.equal(bound2.ok, false);
    assert.ok(!bound2.ok && bound2.errors[0].includes("already has"));
  });
});

describe("manifestSemanticsEqual across attempts", () => {
  const fixture = buildProofFixture();
  const make = (run: string, attempt: string, items = fixture.items) => {
    const built = buildContextManifest({
      task: fixture.task,
      run_id: branded(run),
      attempt_id: branded(attempt),
      items,
      policy: {
        policy_id: fixture.policy.policy_id,
        version: fixture.policy.version,
        digest: fixture.policy.digest,
      },
      now: fixture.now,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error("unreachable");
    return built.manifest;
  };

  it("same items + policy across two attempts → semantically equal", () => {
    assert.equal(
      manifestSemanticsEqual(make("run-a", "att-a"), make("run-b", "att-b")),
      true,
    );
  });

  it("different items → not semantically equal", () => {
    const extra = makeContextItem({
      item_id: "ctx-extra",
      kind: "question",
      data_class: "public",
      scope: { type: "workspace", workspace_id: PROOF_WORKSPACE_ID },
      payload: { q: "extra" },
      created_at: T0,
    });
    assert.equal(
      manifestSemanticsEqual(
        make("run-a", "att-a"),
        make("run-b", "att-b", [...fixture.items, extra]),
      ),
      false,
    );
  });
});

// T1 is referenced to keep the injected-clock convention visible in tests.
void T1;
