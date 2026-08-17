/**
 * P2.1 durable synthetic outcome-review journal — reconstruction, races,
 * role split, context gate. No live stack, no P0 store, no real context.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
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
  parseJournalEvent,
} from "./p2-review-journal.ts";

const LAPTOP = "nP2LAPTOP";
const ACL = parseAcl(`{"${LAPTOP}":["ws-motor"]}`);
const ORCH = parseAcl(JSON.stringify({ [NUC_ORCHESTRATOR_STABLE_ID]: ["ws-motor"] }));

function tempJournalDir(): string {
  return mkdtempSync(join(tmpdir(), "p21-journal-"));
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
  assert.equal((await journal.commit(created.event)).outcome, "appended");
  const submitted = buildTransitionEvent({
    type: "review_submitted",
    actorStableId: LAPTOP,
    draftId: created.event.draft_id,
    templateId: "tpl-p21-review-reply",
    toStatus: "in_review",
    eventId: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal((await journal.commit(submitted.event)).outcome, "appended");
  const decided = buildTransitionEvent({
    type: "review_decided",
    actorStableId: LAPTOP,
    draftId: created.event.draft_id,
    templateId: "tpl-p21-review-reply",
    toStatus: "approved",
    eventId: "33333333-3333-4333-8333-333333333333",
  });
  assert.equal(decided.ok, true);
  if (!decided.ok) return;
  assert.equal((await journal.commit(decided.event)).outcome, "appended");
  const dup = await journal.commit(decided.event);
  assert.equal(dup.ok, true);
  if (!dup.ok) return;
  assert.equal(dup.outcome, "duplicate_noop");
  const rejectSameId = buildTransitionEvent({
    type: "review_decided",
    actorStableId: LAPTOP,
    draftId: created.event.draft_id,
    templateId: "tpl-p21-review-reply",
    toStatus: "rejected",
    eventId: decided.event.event_id,
  });
  assert.equal(rejectSameId.ok, true);
  if (!rejectSameId.ok) return;
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
