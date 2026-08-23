/**
 * P2.1 durable synthetic outcome-review journal — reconstruction, races,
 * role split, context gate. No live stack, no P0 store, no real context.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FORBIDDEN_VIEW_MARKERS, HOME_TENANT_ID } from "./p1-foundation.ts";
import { parseAcl } from "./server.ts";
import { createP2MotorServer } from "./p2-motor-server.ts";
import { NUC_ORCHESTRATOR_STABLE_ID } from "./p2-orchestrator.ts";
import { resolveP2ContextGate } from "./p2-context-gate.ts";
import {
  ReviewJournal,
  P2_SYNTHETIC_TEMPLATES,
  buildDraftCreatedEvent,
  buildTransitionEvent,
  isP0JournalEvent,
  parseJournalEvent,
  projectJournalEvents,
  type JournalDraftRecord,
  type P2JournalEvent,
  type P2P0JournalEvent,
} from "./p2-review-journal.ts";
import { P2_PINNED_P0_REFERENCE } from "./p2-p0-reference.ts";

const LAPTOP = "nP2LAPTOP";
const ACL = parseAcl(`{"${LAPTOP}":["ws-motor"]}`);
const ORCH = parseAcl(JSON.stringify({ [NUC_ORCHESTRATOR_STABLE_ID]: ["ws-motor"] }));

function tempJournalDir(): string {
  return mkdtempSync(join(tmpdir(), "p21-journal-"));
}

function recordFor(journal: ReviewJournal, draftId: string): JournalDraftRecord {
  const record = journal.projection().records.get(draftId);
  assert.ok(record);
  return record;
}

function syntheticSubmitEvent(draftId: string, templateId: string, eventId: string): P2JournalEvent {
  const template = P2_SYNTHETIC_TEMPLATES[templateId];
  assert.ok(template);
  return {
    event_id: eventId,
    type: "review_submitted",
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: LAPTOP,
    draft_id: draftId,
    from_status: "draft",
    to_status: "in_review",
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
    occurred_at: "2026-08-24T10:00:00.000Z",
  };
}

function p0SubmitEvent(
  draftId: string,
  eventId: string,
  identity: { readonly sourceId: string; readonly title: string; readonly digest: string } = {
    sourceId: P2_PINNED_P0_REFERENCE.source_id,
    title: P2_PINNED_P0_REFERENCE.title,
    digest: P2_PINNED_P0_REFERENCE.digest,
  },
): P2P0JournalEvent {
  return {
    event_id: eventId,
    type: "review_submitted",
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: LAPTOP,
    draft_id: draftId,
    from_status: "draft",
    to_status: "in_review",
    source_kind: "p0",
    source_id: identity.sourceId,
    title: identity.title,
    draft_body_digest: identity.digest,
    occurred_at: "2026-08-24T10:00:00.000Z",
  };
}

async function assertIdentityTransitionRejected(
  journal: ReviewJournal,
  created: P2JournalEvent,
  transition: P2JournalEvent,
): Promise<void> {
  assert.ok(parseJournalEvent(transition), "attack event must be structurally valid");
  const before = readFileSync(journal.file, "utf8");
  const committed = await journal.commit(transition);
  assert.deepEqual(committed, { ok: false, reason: "identity_mismatch" });
  assert.equal(readFileSync(journal.file, "utf8"), before);
  assert.equal(journal.projection().records.get(created.draft_id)?.status, "draft");

  const replay = projectJournalEvents([created, transition]);
  assert.equal(replay.records.get(created.draft_id)?.status, "draft");
  assert.equal(replay.patches.length, 0);
}

async function listen(input: {
  readonly resolveId?: string | null;
  readonly journalDir?: string;
  readonly contextEnv?: Record<string, string | undefined>;
  readonly acl?: ReturnType<typeof parseAcl>;
}) {
  const journalDir = input.journalDir ?? tempJournalDir();
  const server = createP2MotorServer({
    acl: input.acl ?? ACL,
    orchestratorAcl: ORCH,
    journalDir,
    contextEnv: input.contextEnv,
    resolveNode: async () =>
      input.resolveId === null || input.resolveId === undefined
        ? input.resolveId === null
          ? null
          : { stableId: LAPTOP, name: "laptop" }
        : { stableId: input.resolveId, name: "node" },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}`, journalDir };
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

async function createDraft(base: string, template = "tpl-p21-review-reply") {
  const res = await fetch(`${base}/api/motor/draft`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspace: HOME_TENANT_ID, synthetic_template_id: template }),
  });
  return { res, body: await json(res) };
}

test("P2.1 journal reconstructs approved review in a new service instance", async () => {
  const journalDir = tempJournalDir();
  const first = await listen({ journalDir, resolveId: LAPTOP });
  try {
    const created = await createDraft(first.base);
    assert.equal(created.res.status, 200);
    const draftId = created.body.draftId;
    assert.equal(
      (
        await json(
          await fetch(`${first.base}/api/motor/review/submit`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId }),
          }),
        )
      ).status,
      "in_review",
    );
    assert.equal(
      (
        await json(
          await fetch(`${first.base}/api/motor/review/decide`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId, decision: "approve" }),
          }),
        )
      ).status,
      "approved",
    );
  } finally {
    first.server.close();
  }

  const second = await listen({ journalDir, resolveId: LAPTOP });
  try {
    const page = await fetch(`${second.base}/motor`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Synthetisch reviewantwoord/);
    assert.match(html, /approved/);
    assert.match(html, /Publiceren blijft DENY/);
    assert.equal(html.includes(FORBIDDEN_VIEW_MARKERS.contextBody), false);
    assert.equal(html.includes(FORBIDDEN_VIEW_MARKERS.secret), false);

    const draftIdMatch = html.match(/data-draft="(draft-p21-tpl-p21-review-reply-[^"]+)"/);
    assert.ok(draftIdMatch);
    const draftId = draftIdMatch[1];
    const again = await fetch(`${second.base}/api/motor/review/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId, decision: "reject" }),
    });
    assert.equal(again.status, 400);
    assert.equal((await json(again)).error, "invalid_transition");

    const publish = await json(
      await fetch(`${second.base}/api/motor/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId }),
      }),
    );
    assert.equal(publish.decision, "DENY");
    assert.equal(publish.visible, true);

    const journalText = readFileSync(join(journalDir, "outcome-review.jsonl"), "utf8");
    assert.match(journalText, /"type":"review_decided"/);
    assert.doesNotMatch(journalText, /context|receipt|settlement|PILOT_STORE/);
    assert.doesNotMatch(journalText, new RegExp(NUC_ORCHESTRATOR_STABLE_ID));
    assert.doesNotMatch(journalText, /FULL_CONTEXT_BODY|p1-demo-secret/);
  } finally {
    second.server.close();
  }
});

test("P2.1 duplicate event_id is a no-op and does not apply a second transition", async () => {
  const journal = new ReviewJournal(tempJournalDir());
  journal.load();
  const created = buildDraftCreatedEvent({
    actorStableId: LAPTOP,
    templateId: "tpl-p21-review-reply",
    eventId: "11111111-1111-4111-8111-111111111111",
    draftId: "draft-p21-tpl-p21-review-reply-dup1",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const createdCommit = await journal.commit(created.event);
  assert.equal(createdCommit.ok, true);
  if (!createdCommit.ok) return;
  assert.equal(createdCommit.outcome, "appended");
  const submitted = buildTransitionEvent({
    type: "review_submitted",
    actorStableId: LAPTOP,
    record: recordFor(journal, created.event.draft_id),
    toStatus: "in_review",
    eventId: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const submittedCommit = await journal.commit(submitted.event);
  assert.equal(submittedCommit.ok, true);
  if (!submittedCommit.ok) return;
  assert.equal(submittedCommit.outcome, "appended");
  const inReviewRecord = recordFor(journal, created.event.draft_id);
  const decided = buildTransitionEvent({
    type: "review_decided",
    actorStableId: LAPTOP,
    record: inReviewRecord,
    toStatus: "approved",
    eventId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(decided.ok, true);
  if (!decided.ok) return;
  const rejectSameId = buildTransitionEvent({
    type: "review_decided",
    actorStableId: LAPTOP,
    record: inReviewRecord,
    toStatus: "rejected",
    eventId: decided.event.event_id,
  });
  assert.equal(rejectSameId.ok, true);
  if (!rejectSameId.ok) return;
  const decidedCommit = await journal.commit(decided.event);
  assert.equal(decidedCommit.ok, true);
  if (!decidedCommit.ok) return;
  assert.equal(decidedCommit.outcome, "appended");
  const dup = await journal.commit(decided.event);
  assert.equal(dup.ok, true);
  if (!dup.ok) return;
  assert.equal(dup.outcome, "duplicate_noop");
  const skipped = await journal.commit(rejectSameId.event);
  assert.equal(skipped.ok, true);
  if (!skipped.ok) return;
  assert.equal(skipped.outcome, "duplicate_noop");
  assert.equal(journal.projection().records.get(created.event.draft_id)?.status, "approved");
});

test("P2.1 concurrent review decisions yield exactly one terminal status", async () => {
  const { server, base } = await listen({ resolveId: LAPTOP });
  try {
    const created = await createDraft(base);
    const draftId = created.body.draftId;
    await fetch(`${base}/api/motor/review/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId }),
    });
    const [approve, reject] = await Promise.all([
      fetch(`${base}/api/motor/review/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId, decision: "approve" }),
      }),
      fetch(`${base}/api/motor/review/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId, decision: "reject" }),
      }),
    ]);
    const bodies = [await json(approve), await json(reject)];
    const wins = bodies.filter((row) => row.status === "approved" || row.status === "rejected");
    const losses = bodies.filter((row) => row.error === "invalid_transition");
    assert.equal(wins.length, 1);
    assert.equal(losses.length, 1);
    const terminal = wins[0]?.status;
    assert.ok(terminal === "approved" || terminal === "rejected");

    const third = await json(
      await fetch(`${base}/api/motor/review/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          draftId,
          decision: terminal === "approved" ? "reject" : "approve",
        }),
      }),
    );
    assert.equal(third.error, "invalid_transition");
  } finally {
    server.close();
  }
});

test("P2.1 laptop may review; NUC and unknown nodes get 403", async () => {
  const journalDir = tempJournalDir();
  const laptop = await listen({ journalDir, resolveId: LAPTOP });
  const nuc = await listen({ journalDir, resolveId: NUC_ORCHESTRATOR_STABLE_ID });
  const unknown = await listen({ journalDir, resolveId: null });
  try {
    const created = await createDraft(laptop.base);
    assert.equal(created.res.status, 200);
    const draftId = created.body.draftId;

    for (const node of [nuc, unknown]) {
      assert.equal((await fetch(`${node.base}/motor`)).status, 403);
      for (const [path, payload] of [
        ["/api/motor/draft", { workspace: HOME_TENANT_ID, synthetic_template_id: "tpl-p21-review-reply" }],
        ["/api/motor/review/submit", { workspace: HOME_TENANT_ID, draftId }],
        ["/api/motor/review/decide", { workspace: HOME_TENANT_ID, draftId, decision: "approve" }],
      ] as const) {
        const res = await fetch(`${node.base}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 403);
      }
    }

    const submitted = await fetch(`${laptop.base}/api/motor/review/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId }),
    });
    assert.equal((await json(submitted)).status, "in_review");
  } finally {
    laptop.server.close();
    nuc.server.close();
    unknown.server.close();
  }
});

test("P2.1 context gate fails closed without reading files or accepting body.context", async () => {
  assert.equal(resolveP2ContextGate({}).state, "synthetic");
  assert.equal(resolveP2ContextGate({ CONTEXT_MODE: "private" }).state, "private_declared_absent");
  assert.equal(resolveP2ContextGate({ PILOT_P2_CONTEXT_MODE: "private" }).state, "private_declared_absent");
  assert.equal(
    resolveP2ContextGate({ CONTEXT_MODE: "private", CONTEXT_FILE: "/tmp/does-not-exist-p21.txt" }).state,
    "private_blocked",
  );
  assert.equal(resolveP2ContextGate({ QDRANT_URL: "http://127.0.0.1:6333" }).state, "private_blocked");

  const laptop = await listen({ resolveId: LAPTOP });
  const absent = await listen({
    resolveId: LAPTOP,
    contextEnv: { CONTEXT_MODE: "private" },
  });
  const blocked = await listen({
    resolveId: LAPTOP,
    contextEnv: { CONTEXT_FILE: "/tmp/does-not-exist-p21.txt" },
  });
  try {
    const withContext = await fetch(`${laptop.base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: HOME_TENANT_ID,
        synthetic_template_id: "tpl-p21-review-reply",
        context: "echte context",
      }),
    });
    assert.equal(withContext.status, 400);
    assert.equal((await json(withContext)).error, "context_not_allowed");

    const freeBody = await fetch(`${laptop.base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: HOME_TENANT_ID,
        synthetic_template_id: "tpl-p21-review-reply",
        title: "vrije blijvende tekst",
        body: "niet reconstructeerbaar",
      }),
    });
    assert.equal(freeBody.status, 400);
    assert.equal((await json(freeBody)).error, "free_draft_body_not_allowed");

    const privateFlag = await json(
      await fetch(`${absent.base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          synthetic_template_id: "tpl-p21-review-reply",
        }),
      }),
    );
    assert.equal(privateFlag.error, "private_declared_absent");

    const blockedWrite = await json(
      await fetch(`${blocked.base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          synthetic_template_id: "tpl-p21-review-reply",
        }),
      }),
    );
    assert.equal(blockedWrite.error, "private_blocked");

    for (const node of [laptop, absent, blocked]) {
      const health = await json(await fetch(`${node.base}/motor/health`));
      assert.deepEqual(health, { ok: true });
      const blob = JSON.stringify(health);
      assert.equal(blob.includes("context"), false);
      assert.equal(blob.includes("draft"), false);
      assert.equal(blob.includes("review"), false);
      assert.equal(blob.includes("acl"), false);
    }
  } finally {
    laptop.server.close();
    absent.server.close();
    blocked.server.close();
  }
});

test("P2.1 parser rejects foreign workspace, NUC actor and extra keys", () => {
  const template = P2_SYNTHETIC_TEMPLATES["tpl-p21-review-reply"];
  assert.ok(template);
  const base = {
    event_id: "44444444-4444-4444-8444-444444444444",
    type: "draft_created",
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: LAPTOP,
    draft_id: "draft-p21-tpl-p21-review-reply-parse",
    from_status: null,
    to_status: "draft",
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
    occurred_at: "2026-08-17T00:00:00.000Z",
  };
  assert.ok(parseJournalEvent(base));
  assert.equal(parseJournalEvent({ ...base, workspace_id: "ws-anders" }), null);
  assert.equal(parseJournalEvent({ ...base, actor_stable_id: NUC_ORCHESTRATOR_STABLE_ID }), null);
  assert.equal(parseJournalEvent({ ...base, context: "nope" }), null);
  assert.equal(parseJournalEvent({ ...base, actor_stable_id: "100.123.185.0" }), null);
});

test("P0 draft rejects a synthetic transition in commit and projection", async () => {
  const journal = new ReviewJournal(tempJournalDir());
  journal.load();
  const created = buildDraftCreatedEvent({
    actorStableId: LAPTOP,
    sourceId: P2_PINNED_P0_REFERENCE.source_id,
    draftId: "draft-p21-p0-cross-to-synthetic",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await journal.commit(created.event)).ok, true);

  await assertIdentityTransitionRejected(
    journal,
    created.event,
    syntheticSubmitEvent(
      created.event.draft_id,
      "tpl-p21-review-reply",
      "70000000-0000-4000-8000-000000000001",
    ),
  );
});

test("synthetic draft rejects a P0 transition in commit and projection", async () => {
  const journal = new ReviewJournal(tempJournalDir());
  journal.load();
  const created = buildDraftCreatedEvent({
    actorStableId: LAPTOP,
    templateId: "tpl-p21-review-reply",
    draftId: "draft-p21-synthetic-cross-to-p0",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await journal.commit(created.event)).ok, true);

  await assertIdentityTransitionRejected(
    journal,
    created.event,
    p0SubmitEvent(created.event.draft_id, "70000000-0000-4000-8000-000000000002"),
  );
});

test("synthetic draft rejects a different template in commit and projection", async () => {
  const journal = new ReviewJournal(tempJournalDir());
  journal.load();
  const created = buildDraftCreatedEvent({
    actorStableId: LAPTOP,
    templateId: "tpl-p21-review-reply",
    draftId: "draft-p21-synthetic-template-mismatch",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await journal.commit(created.event)).ok, true);

  await assertIdentityTransitionRejected(
    journal,
    created.event,
    syntheticSubmitEvent(
      created.event.draft_id,
      "tpl-p21-observation-note",
      "70000000-0000-4000-8000-000000000003",
    ),
  );
});

test("P0 lifecycle rejects changed source, title, or digest in commit and projection", async () => {
  const journal = new ReviewJournal(tempJournalDir());
  journal.load();
  const created = buildDraftCreatedEvent({
    actorStableId: LAPTOP,
    sourceId: P2_PINNED_P0_REFERENCE.source_id,
    draftId: "draft-p21-p0-identity-mismatch",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal((await journal.commit(created.event)).ok, true);

  const mutations = [
    {
      sourceId: "run-shadow-1786711414804",
      title: P2_PINNED_P0_REFERENCE.title,
      digest: P2_PINNED_P0_REFERENCE.digest,
    },
    {
      sourceId: P2_PINNED_P0_REFERENCE.source_id,
      title: "Gewijzigde P0-titel",
      digest: P2_PINNED_P0_REFERENCE.digest,
    },
    {
      sourceId: P2_PINNED_P0_REFERENCE.source_id,
      title: P2_PINNED_P0_REFERENCE.title,
      digest: `sha256:${"a".repeat(64)}`,
    },
  ] as const;
  for (const [index, identity] of mutations.entries()) {
    await assertIdentityTransitionRejected(
      journal,
      created.event,
      p0SubmitEvent(
        created.event.draft_id,
        `70000000-0000-4000-8000-00000000001${index}`,
        identity,
      ),
    );
  }
});

test("P0 restart and transitions are journal-only and never consult the current resolver", async () => {
  const historicalIdentity = {
    sourceId: "run-shadow-1700000000000",
    title: "Historisch P0-resultaat",
    digest: `sha256:${"b".repeat(64)}`,
  } as const;
  const created: P2P0JournalEvent = {
    event_id: "71000000-0000-4000-8000-000000000001",
    type: "draft_created",
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: LAPTOP,
    draft_id: "draft-p21-p0-historical-restart",
    from_status: null,
    to_status: "draft",
    source_kind: "p0",
    source_id: historicalIdentity.sourceId,
    title: historicalIdentity.title,
    draft_body_digest: historicalIdentity.digest,
    occurred_at: "2026-08-20T08:00:00.000Z",
  };
  assert.ok(parseJournalEvent(created));

  const draftRecord = projectJournalEvents([created]).records.get(created.draft_id);
  assert.ok(draftRecord);
  const submitted = buildTransitionEvent({
    type: "review_submitted",
    actorStableId: LAPTOP,
    record: draftRecord,
    toStatus: "in_review",
    eventId: "71000000-0000-4000-8000-000000000002",
    occurredAt: "2026-08-20T08:01:00.000Z",
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok || !isP0JournalEvent(submitted.event)) return;
  assert.equal(submitted.event.source_id, historicalIdentity.sourceId);
  assert.equal(submitted.event.title, historicalIdentity.title);
  assert.equal(submitted.event.draft_body_digest, historicalIdentity.digest);

  const inReviewRecord = projectJournalEvents([created, submitted.event]).records.get(created.draft_id);
  assert.ok(inReviewRecord);
  const decided = buildTransitionEvent({
    type: "review_decided",
    actorStableId: LAPTOP,
    record: inReviewRecord,
    toStatus: "approved",
    eventId: "71000000-0000-4000-8000-000000000003",
    occurredAt: "2026-08-20T08:02:00.000Z",
  });
  assert.equal(decided.ok, true);
  if (!decided.ok) return;

  const dir = tempJournalDir();
  writeFileSync(
    join(dir, "outcome-review.jsonl"),
    `${[created, submitted.event, decided.event].map((event) => JSON.stringify(event)).join("\n")}\n`,
  );
  let resolverCalls = 0;
  const journal = new ReviewJournal(dir, () => {
    resolverCalls += 1;
    throw new Error("resolver_must_not_run_during_restart");
  });
  const projection = journal.load();
  assert.equal(resolverCalls, 0);
  const restored = projection.records.get(created.draft_id);
  assert.equal(restored?.status, "approved");
  assert.equal(restored?.sourceId, historicalIdentity.sourceId);
  assert.equal(restored?.title, historicalIdentity.title);
  assert.equal(restored?.digest, historicalIdentity.digest);
  assert.equal(journal.projection().records.get(created.draft_id)?.status, "approved");
  assert.equal(resolverCalls, 0);

  const transitionDir = tempJournalDir();
  writeFileSync(join(transitionDir, "outcome-review.jsonl"), `${JSON.stringify(created)}\n`);
  let transitionResolverCalls = 0;
  const transitionJournal = new ReviewJournal(transitionDir, () => {
    transitionResolverCalls += 1;
    throw new Error("resolver_must_not_run_during_transition");
  });
  const transitionProjection = transitionJournal.load();
  const restoredDraft = transitionProjection.records.get(created.draft_id);
  assert.ok(restoredDraft);
  const transition = buildTransitionEvent({
    type: "review_submitted",
    actorStableId: LAPTOP,
    record: restoredDraft,
    toStatus: "in_review",
    eventId: "71000000-0000-4000-8000-000000000004",
    occurredAt: "2026-08-20T08:03:00.000Z",
  });
  assert.equal(transition.ok, true);
  if (!transition.ok) return;
  const transitionCommit = await transitionJournal.commit(transition.event);
  assert.equal(transitionCommit.ok, true);
  assert.equal(transitionJournal.projection().records.get(created.draft_id)?.status, "in_review");
  assert.equal(transitionResolverCalls, 0);
});

test("P0 pin rides the same review lifecycle and reloads title from journal", async () => {
  const journalDir = tempJournalDir();
  const first = await listen({ journalDir, resolveId: LAPTOP });
  let draftId = "";
  try {
    const created = await json(
      await fetch(`${first.base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          source_kind: "p0",
          source_id: P2_PINNED_P0_REFERENCE.source_id,
        }),
      }),
    );
    assert.equal(created.ok, true);
    assert.equal(created.source_kind, "p0");
    assert.equal(created.source_id, P2_PINNED_P0_REFERENCE.source_id);
    assert.equal("synthetic_template_id" in created, false);
    draftId = String(created.draftId);
    assert.match(draftId, /^draft-p21-p0-/);

    const submitted = await json(
      await fetch(`${first.base}/api/motor/review/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId }),
      }),
    );
    assert.equal(submitted.status, "in_review");

    const decided = await json(
      await fetch(`${first.base}/api/motor/review/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId, decision: "approve" }),
      }),
    );
    assert.equal(decided.status, "approved");

    const publish = await json(
      await fetch(`${first.base}/api/motor/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: HOME_TENANT_ID, draftId }),
      }),
    );
    assert.equal(publish.decision, "DENY");
  } finally {
    first.server.close();
  }

  const journalText = readFileSync(join(journalDir, "outcome-review.jsonl"), "utf8");
  const lines = journalText.trim().split("\n");
  assert.equal(lines.length, 3);
  for (const line of lines) {
    const parsed = parseJournalEvent(JSON.parse(line));
    assert.ok(parsed);
    assert.equal(isP0JournalEvent(parsed!), true);
    if (!parsed || !isP0JournalEvent(parsed)) return;
    assert.equal(parsed.source_id, P2_PINNED_P0_REFERENCE.source_id);
    assert.equal(parsed.title, P2_PINNED_P0_REFERENCE.title);
    assert.equal(parsed.draft_body_digest, P2_PINNED_P0_REFERENCE.digest);
    assert.equal("synthetic_template_id" in parsed, false);
    assert.equal("body" in parsed, false);
  }

  const second = await listen({ journalDir, resolveId: LAPTOP });
  try {
    const html = await (await fetch(`${second.base}/motor`)).text();
    assert.match(html, new RegExp(`data-title="1">${P2_PINNED_P0_REFERENCE.title}`));
    assert.match(html, new RegExp(`data-digest="${P2_PINNED_P0_REFERENCE.digest}"`));
    assert.match(html, /approved/);
    assert.doesNotMatch(html, /FULL_CONTEXT_BODY|p1-demo-secret/);

    const view = await json(await fetch(`${second.base}/api/motor/view`));
    const items = (view.journal as { items: Array<Record<string, unknown>> }).items;
    const item = items.find((row) => row.draft_id === draftId);
    assert.equal(item?.title, P2_PINNED_P0_REFERENCE.title);
    assert.equal(item?.digest, P2_PINNED_P0_REFERENCE.digest);
    assert.equal(item?.source_kind, "p0");
    assert.equal(item?.source_id, P2_PINNED_P0_REFERENCE.source_id);
    assert.equal("synthetic_template_id" in (item ?? {}), false);
    assert.equal("body" in (item ?? {}), false);
  } finally {
    second.server.close();
  }
});

test("P0 HTTP rejects free title/body, unknown kind, and extra keys", async () => {
  const { server, base } = await listen({ resolveId: LAPTOP });
  try {
    const freeTitle = await json(
      await fetch(`${base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          source_kind: "p0",
          source_id: P2_PINNED_P0_REFERENCE.source_id,
          title: "vrije titel",
        }),
      }),
    );
    assert.equal(freeTitle.error, "free_draft_body_not_allowed");

    const unknownKind = await json(
      await fetch(`${base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          source_kind: "qdrant",
          source_id: P2_PINNED_P0_REFERENCE.source_id,
        }),
      }),
    );
    assert.equal(unknownKind.error, "unknown_source_kind");

    const extra = await json(
      await fetch(`${base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: HOME_TENANT_ID,
          source_kind: "p0",
          source_id: P2_PINNED_P0_REFERENCE.source_id,
          evidence_ids: ["ev-1"],
        }),
      }),
    );
    assert.equal(extra.error, "free_intake_not_allowed");
  } finally {
    server.close();
  }
});

test("hybrid journal events do not parse; old synthetic lines still do", () => {
  const template = P2_SYNTHETIC_TEMPLATES["tpl-p21-review-reply"];
  assert.ok(template);
  const synthetic = {
    event_id: "55555555-5555-4555-8555-555555555555",
    type: "draft_created",
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: LAPTOP,
    draft_id: "draft-p21-tpl-p21-review-reply-old",
    from_status: null,
    to_status: "draft",
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
    occurred_at: "2026-08-17T00:00:00.000Z",
  };
  assert.ok(parseJournalEvent(synthetic));
  assert.equal(
    parseJournalEvent({
      ...synthetic,
      source_kind: "p0",
      source_id: P2_PINNED_P0_REFERENCE.source_id,
      title: P2_PINNED_P0_REFERENCE.title,
    }),
    null,
  );
  assert.equal(
    parseJournalEvent({
      event_id: "66666666-6666-4666-8666-666666666666",
      type: "draft_created",
      workspace_id: HOME_TENANT_ID,
      actor_stable_id: LAPTOP,
      draft_id: "draft-p21-p0-hybrid",
      from_status: null,
      to_status: "draft",
      source_kind: "p0",
      source_id: P2_PINNED_P0_REFERENCE.source_id,
      title: P2_PINNED_P0_REFERENCE.title,
      draft_body_digest: P2_PINNED_P0_REFERENCE.digest,
      synthetic_template_id: template.id,
      occurred_at: "2026-08-23T00:00:00.000Z",
    }),
    null,
  );
});
