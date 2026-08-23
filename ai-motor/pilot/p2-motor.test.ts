import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { IncomingMessage } from "node:http";

import { FORBIDDEN_VIEW_MARKERS, HOME_TENANT_ID, OTHER_TENANT_ID } from "./p1-foundation.ts";
import { parseAcl } from "./server.ts";
import { assertSafeBindHost, P2_PINNED_ORIGIN, resolveP2Bind } from "./p2-bind.ts";
import { createP2MotorServer } from "./p2-motor-server.ts";
import { NUC_ORCHESTRATOR_STABLE_ID } from "./p2-orchestrator.ts";
import { P2_JOURNAL_EVENT_TYPES, P2_SYNTHETIC_TEMPLATES } from "./p2-review-journal.ts";

const ACL = parseAcl('{"nP2MOTOR":["ws-motor"],"nP2ANDERS":["ws-anders"]}');

function tempJournalDir(): string {
  return mkdtempSync(join(tmpdir(), "p21-journal-"));
}

async function listen(journalDir = tempJournalDir()) {
  const server = createP2MotorServer({
    acl: ACL,
    journalDir,
    resolveNode: async (ip) => {
      if (ip.endsWith("2")) return { stableId: "nP2ANDERS", name: "anders" };
      return { stableId: "nP2MOTOR", name: "motor" };
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

test("P2.0 bind refuses 0.0.0.0 and defaults to loopback:4420", () => {
  assert.throws(() => assertSafeBindHost("0.0.0.0"));
  assert.throws(() => assertSafeBindHost("::"));
  assert.deepEqual(resolveP2Bind({}), { host: "127.0.0.1", port: 4420 });
  assert.deepEqual(resolveP2Bind({ PILOT_P2_HOST: "100.97.30.22", PILOT_P2_PORT: "4420" }), {
    host: "100.97.30.22",
    port: 4420,
  });
});

test("P2.0 compose overlay is additive and never downs the stack", () => {
  const compose = readFileSync(join(import.meta.dirname, "../infra/pilot/compose.p2-motor.yaml"), "utf8");
  assert.match(compose, /motor-p2-ui/);
  assert.match(compose, /PILOT_P2_HOST/);
  assert.match(compose, /PILOT_P2_ACL/);
  assert.match(compose, /PILOT_P2_ORCHESTRATOR_ACL/);
  assert.match(compose, /P2_REPO_PATH/);
  assert.match(compose, /p2-motor-server/);
  assert.doesNotMatch(compose.split("services:")[1] ?? "", /PILOT_ACL[^_]/);
  const services = compose.split(/^services:\s*$/m)[1] ?? "";
  assert.doesNotMatch(services, /["']0\.0\.0\.0["']/);
  assert.doesNotMatch(services, /pilot-drafts|pilot-context|PILOT_STORE_SECRET|MODEL_PORT_URL/);
  assert.doesNotMatch(services, /depends_on:/);
  assert.match(compose, /p2-review:\/p2-review/);
  assert.match(compose, /PILOT_P2_JOURNAL_DIR: \/p2-review/);
  assert.match(compose, /motor-pilot_pilot-p2-review/);
  assert.doesNotMatch(compose, /sqlite|SQLITE|better-sqlite3|postgres:\/\/|POSTGRES_|drizzle/i);
});

test("P2.0 health/readiness has no context, drafts, secrets or ACL", async () => {
  const { server, base } = await listen();
  try {
    for (const path of ["/motor/health", "/motor/ready"]) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200);
      const body = await json(res);
      assert.deepEqual(body, { ok: true });
      assert.equal(Object.keys(body).join(","), "ok");
      const blob = JSON.stringify(body);
      assert.equal(blob.includes("context"), false);
      assert.equal(blob.includes("draft"), false);
      assert.equal(blob.includes("secret"), false);
      assert.equal(blob.includes("acl"), false);
    }
  } finally {
    server.close();
  }
});

test("P2.0 opens /motor for the home workspace and lists Nu/Projecten/Afdelingen", async () => {
  const { server, base } = await listen();
  try {
    const page = await fetch(`${base}/motor`);
    if (page.status !== 200) {
      assert.equal(page.status, 200, await page.text());
    }
    const html = await page.text();
    assert.match(html, /Nu/);
    assert.match(html, /Projecten/);
    assert.match(html, /Afdelingen/);
    assert.match(html, /Publiceren blijft DENY/);
    assert.match(html, /type="button"/);
    assert.match(html, /location\.reload/);
    assert.match(html, /vast voorbeeld/);
    assert.doesNotMatch(html, /data-act="submit"/);

    const view = await fetch(`${base}/api/motor/view?workspace=ws-motor`);
    assert.equal(view.status, 200);
    const body = await json(view);
    assert.deepEqual(body.nav, ["Nu", "Projecten", "Afdelingen"]);
    assert.equal(body.workspace, HOME_TENANT_ID);
  } finally {
    server.close();
  }
});

test("P2.0 session stays on ws-motor and foreign routes fail closed", async () => {
  const { server, base } = await listen();
  try {
    const foreignPath = await fetch(`${base}/motor/${OTHER_TENANT_ID}`);
    assert.equal(foreignPath.status, 403);

    const foreignQuery = await fetch(`${base}/api/motor/view?workspace=${OTHER_TENANT_ID}`);
    assert.equal(foreignQuery.status, 403);

    const missing = await fetch(`${base}/`);
    assert.equal(missing.status, 404);
    const draft = await fetch(`${base}/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(draft.status, 404);
    const decision = await fetch(`${base}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(decision.status, 404);
  } finally {
    server.close();
  }
});

test("P2.0 review machine draft → in_review → approved|rejected, publish DENY, no effectors", async () => {
  const { server, base } = await listen();
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0]);
    if (url.startsWith(base)) return originalFetch(...args);
    networkCalls += 1;
    throw new Error(`unexpected external fetch: ${url}`);
  };
  try {
    const viewRes = await fetch(`${base}/api/motor/view?workspace=ws-motor`);
    await json(viewRes);
    const created = await fetch(`${base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-p21-review-reply",
      }),
    });
    assert.equal(created.status, 200);
    const draft = await json(created);
    assert.equal(draft.state, "draft");
    const afterCreate = await (await fetch(`${base}/motor`)).text();
    assert.match(afterCreate, new RegExp(`data-act="submit" data-draft="${draft.draftId}"`));
    assert.doesNotMatch(afterCreate, new RegExp(`data-act="approve" data-draft="${draft.draftId}"`));

    const submitted = await fetch(`${base}/api/motor/review/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor", draftId: draft.draftId }),
    });
    assert.equal((await json(submitted)).status, "in_review");

    const approved = await fetch(`${base}/api/motor/review/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        draftId: draft.draftId,
        decision: "approve",
      }),
    });
    assert.equal((await json(approved)).status, "approved");

    const publish = await fetch(`${base}/api/motor/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor", draftId: draft.draftId }),
    });
    const denied = await json(publish);
    assert.equal(denied.decision, "DENY");
    assert.equal(denied.visible, true);
    assert.equal(networkCalls, 0);

    const second = await fetch(`${base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-p21-observation-note",
      }),
    });
    const draft2 = await json(second);
    await fetch(`${base}/api/motor/review/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor", draftId: draft2.draftId }),
    });
    const rejected = await fetch(`${base}/api/motor/review/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        draftId: draft2.draftId,
        decision: "reject",
      }),
    });
    assert.equal((await json(rejected)).status, "rejected");
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});

test("P2.0 evidence rail has no content or secrets", async () => {
  const { server, base } = await listen();
  try {
    const res = await fetch(`${base}/api/motor/evidence?workspace=ws-motor`);
    assert.equal(res.status, 200);
    const body = await json(res);
    const blob = JSON.stringify(body);
    assert.equal(blob.includes(FORBIDDEN_VIEW_MARKERS.secret), false);
    assert.equal(blob.includes(FORBIDDEN_VIEW_MARKERS.contextBody), false);
    assert.equal(blob.includes(FORBIDDEN_VIEW_MARKERS.rawRuntimeLog), false);
    assert.match(blob, /"refs"/);
  } finally {
    server.close();
  }
});

test("P2.0 unknown node is denied and context bodies are rejected", async () => {
  const server = createP2MotorServer({
    acl: ACL,
    journalDir: tempJournalDir(),
    resolveNode: async () => null,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(`${base}/motor`);
    assert.equal(page.status, 403);
    const withContext = await fetch(`${base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor", context: "echte context" }),
    });
    assert.equal(withContext.status, 400);
    assert.equal((await json(withContext)).error, "context_not_allowed");
  } finally {
    server.close();
  }
});

test("P2.0 listen helper typecheck: IncomingMessage stays request-scoped", () => {
  const probe: IncomingMessage | undefined = undefined;
  assert.equal(probe, undefined);
  assert.equal(P2_PINNED_ORIGIN, "http://100.97.30.22:4420/motor");
});

test("POST /api/motor/draft uses the ReviewReceived seam with WhoIs/ACL authority", async () => {
  const serverSrc = readFileSync(join(import.meta.dirname, "p2-motor-server.ts"), "utf8");
  assert.match(serverSrc, /receiveSyntheticReview/);
  assert.match(serverSrc, /workspaceId: access\.workspace/);
  assert.match(serverSrc, /stableId: access\.node\.stableId/);
  assert.doesNotMatch(serverSrc, /body\.actor|body\.stableId|body\.actor_stable_id/);
  assert.doesNotMatch(serverSrc, /n42QGiXouB21CNTRL/);

  const deniedServer = createP2MotorServer({
    acl: ACL,
    journalDir: tempJournalDir(),
    resolveNode: async () => null,
  });
  await new Promise<void>((resolve) => deniedServer.listen(0, "127.0.0.1", resolve));
  const deniedAddress = deniedServer.address();
  assert.ok(deniedAddress !== null && typeof deniedAddress === "object");
  const deniedBase = `http://127.0.0.1:${deniedAddress.port}`;
  try {
    const denied = await fetch(`${deniedBase}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-p21-review-reply",
      }),
    });
    assert.equal(denied.status, 403);
    assert.equal((await json(denied)).error, "node_not_allowed");
  } finally {
    deniedServer.close();
  }

  const journalDir = tempJournalDir();
  const { server, base } = await listen(journalDir);
  try {
    const created = await fetch(`${base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-p21-review-reply",
        actor_stable_id: "nFAKEACTOR",
      }),
    });
    assert.equal(created.status, 200);
    const draft = await json(created);
    assert.equal(draft.state, "draft");
    const journalText = readFileSync(join(journalDir, "outcome-review.jsonl"), "utf8");
    assert.match(journalText, /"actor_stable_id":"nP2MOTOR"/);
    assert.doesNotMatch(journalText, /nFAKEACTOR/);
    assert.doesNotMatch(journalText, /ReviewReceived/);
    assert.match(journalText, /"type":"draft_created"/);
  } finally {
    server.close();
  }
});

test("P2.2 overview reconstructs journal status on existing GET without a second inbox", async () => {
  const productFiles = [
    "p2-motor-server.ts",
    "p2-motor-ui.ts",
    "p2-review-journal.ts",
    "p2-review-received-seam.ts",
    "p2-bind.ts",
    "p2-orchestrator.ts",
    "p2-context-gate.ts",
    "p2-kiosk-policy.ts",
    "p2-p0-reference.ts",
  ];
  for (const file of productFiles) {
    const src = readFileSync(join(import.meta.dirname, file), "utf8");
    assert.doesNotMatch(src, /n42QGiXouB21CNTRL/);
  }
  const serverSrc = readFileSync(join(import.meta.dirname, "p2-motor-server.ts"), "utf8");
  assert.doesNotMatch(serverSrc, /\/api\/motor\/overview|\/motor\/overview/);
  assert.match(serverSrc, /reviewStatusForDraft/);
  assert.match(serverSrc, /summarizeJournal/);
  const getMotor = serverSrc.slice(
    serverSrc.indexOf('method === "GET" && (pathname === "/motor"'),
    serverSrc.indexOf('pathname === "/api/motor/view"'),
  );
  const getView = serverSrc.slice(
    serverSrc.indexOf('method === "GET" && pathname === "/api/motor/view"'),
    serverSrc.indexOf('pathname === "/api/motor/evidence"'),
  );
  assert.doesNotMatch(getMotor, /journal\.commit/);
  assert.doesNotMatch(getView, /journal\.commit/);
  assert.deepEqual([...P2_JOURNAL_EVENT_TYPES], ["draft_created", "review_submitted", "review_decided"]);

  const journalDir = tempJournalDir();
  const { server, base } = await listen(journalDir);
  try {
    const openDraft = await json(
      await fetch(`${base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: "ws-motor",
          synthetic_template_id: "tpl-p21-review-reply",
        }),
      }),
    );
    const reviewing = await json(
      await fetch(`${base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: "ws-motor",
          synthetic_template_id: "tpl-p21-observation-note",
        }),
      }),
    );
    await fetch(`${base}/api/motor/review/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor", draftId: reviewing.draftId }),
    });
    const doneDraft = await json(
      await fetch(`${base}/api/motor/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace: "ws-motor",
          synthetic_template_id: "tpl-p21-review-reply",
        }),
      }),
    );
    await fetch(`${base}/api/motor/review/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor", draftId: doneDraft.draftId }),
    });
    await fetch(`${base}/api/motor/review/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        draftId: doneDraft.draftId,
        decision: "approve",
      }),
    });

    const journalFile = join(journalDir, "outcome-review.jsonl");
    const before = readFileSync(journalFile);

    const page = await fetch(`${base}/motor`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /id="journal-overview"/);
    assert.match(html, /open 1 · in review 1 · afgehandeld 1/);
    assert.match(html, new RegExp(`data-journal="1"[^>]*data-draft="${openDraft.draftId}"|data-draft="${openDraft.draftId}"[^>]*data-journal="1"`));
    assert.match(html, new RegExp(`data-draft="${openDraft.draftId}"[\\s\\S]*?<em>draft</em>`));
    assert.match(html, new RegExp(`data-draft="${reviewing.draftId}"[\\s\\S]*?<em>in_review</em>`));
    assert.match(html, new RegExp(`data-draft="${doneDraft.draftId}"[\\s\\S]*?<em>approved</em>`));
    assert.match(html, /data-list="seed"/);
    assert.match(html, /Vast voorbeeld/);
    assert.match(html, /vast voorbeeld/);
    const journalLists = html.match(/<ul data-list="journal">[\s\S]*?<\/ul>/g) ?? [];
    assert.ok(journalLists.length > 0);
    for (const list of journalLists) {
      assert.match(list, /draft-p21-/);
      assert.doesNotMatch(list, /draft-pending-1|draft-open-1|draft-review-1|draft-obs-1/);
      assert.doesNotMatch(list, /Wachtend concept|Openstaand concept/);
    }
    assert.equal(html.includes(FORBIDDEN_VIEW_MARKERS.secret), false);
    assert.equal(html.includes(FORBIDDEN_VIEW_MARKERS.contextBody), false);
    assert.doesNotMatch(html, /FULL_CONTEXT_BODY|p1-demo-secret|BEGIN [A-Z ]*PRIVATE KEY/);
    const reply = P2_SYNTHETIC_TEMPLATES["tpl-p21-review-reply"];
    const note = P2_SYNTHETIC_TEMPLATES["tpl-p21-observation-note"];
    assert.match(html, new RegExp(`data-draft="${openDraft.draftId}"[\\s\\S]*?data-title="1">${reply.title}`));
    assert.match(html, new RegExp(`data-draft="${openDraft.draftId}"[\\s\\S]*?data-digest="${reply.digest}"`));
    assert.match(html, new RegExp(`data-draft="${reviewing.draftId}"[\\s\\S]*?data-title="1">${note.title}`));
    assert.match(html, new RegExp(`data-draft="${reviewing.draftId}"[\\s\\S]*?data-digest="${note.digest}"`));
    assert.doesNotMatch(html, new RegExp(reply.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, new RegExp(note.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, /<textarea|<input[^>]+name="body"|P0-body|draft_body[^_]/);

    const viewRes = await fetch(`${base}/api/motor/view?workspace=ws-motor`);
    assert.equal(viewRes.status, 200);
    const view = await json(viewRes);
    const journal = view.journal as {
      counts: { open: number; in_review: number; done: number };
      items: Array<Record<string, unknown>>;
    };
    assert.deepEqual(journal.counts, { open: 1, in_review: 1, done: 1 });
    assert.equal(journal.items.length, 3);
    for (const item of journal.items) {
      assert.equal(String(item.draft_id).startsWith("draft-p21-"), true);
      assert.equal(typeof item.title, "string");
      assert.equal(typeof item.status, "string");
      assert.equal(["draft_created", "review_submitted", "review_decided"].includes(String(item.type)), true);
      assert.equal(typeof item.synthetic_template_id, "string");
      assert.equal(String(item.digest).startsWith("sha256:"), true);
      assert.equal(typeof item.occurred_at, "string");
      assert.equal(item.actor_stable_id, "nP2MOTOR");
      assert.equal("body" in item, false);
    }
    const byId = Object.fromEntries(journal.items.map((item) => [item.draft_id, item]));
    assert.equal(byId[String(openDraft.draftId)]?.status, "draft");
    assert.equal(byId[String(reviewing.draftId)]?.status, "in_review");
    assert.equal(byId[String(doneDraft.draftId)]?.status, "approved");
    const journalBlob = JSON.stringify(journal);
    assert.doesNotMatch(journalBlob, /draft-pending-1|draft-open-1|draft-review-1|draft-obs-1/);
    assert.doesNotMatch(journalBlob, /Wachtend concept|Openstaand concept/);
    assert.doesNotMatch(journalBlob, /ReviewReceived/);
    assert.equal(journalBlob.includes(FORBIDDEN_VIEW_MARKERS.secret), false);
    assert.equal(journalBlob.includes(FORBIDDEN_VIEW_MARKERS.contextBody), false);

    const projects = view.projects as Array<{
      drafts: Array<{ id: string; title?: string; digest?: string; state: string; status: string; body?: unknown }>;
    }>;
    const allDrafts = projects.flatMap((row) => row.drafts);
    const journalDraft = allDrafts.find((draft) => draft.id === openDraft.draftId);
    const seedDraft = allDrafts.find((draft) => draft.id === "draft-pending-1");
    assert.equal(journalDraft?.state, "draft");
    assert.equal(journalDraft?.status, "draft");
    assert.equal(journalDraft?.title, reply.title);
    assert.equal(journalDraft?.digest, reply.digest);
    assert.equal("body" in (journalDraft ?? {}), false);
    assert.equal(allDrafts.find((draft) => draft.id === reviewing.draftId)?.status, "in_review");
    assert.equal(allDrafts.find((draft) => draft.id === doneDraft.draftId)?.status, "approved");
    assert.ok(seedDraft);
    assert.notEqual(seedDraft?.status, undefined);

    assert.equal(readFileSync(journalFile, "utf8"), before.toString("utf8"));

    const postMotor = await fetch(`${base}/motor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal([404, 405].includes(postMotor.status), true);
    const postView = await fetch(`${base}/api/motor/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: "ws-motor" }),
    });
    assert.equal([404, 405].includes(postView.status), true);

    const extraKeys = await fetch(`${base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-p21-review-reply",
        title: "vrije titel",
        body: "vrije body",
      }),
    });
    assert.equal(extraKeys.status, 400);
    assert.equal((await json(extraKeys)).error, "free_draft_body_not_allowed");
    const unknownTemplate = await fetch(`${base}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-unknown",
      }),
    });
    assert.equal(unknownTemplate.status, 400);
    assert.equal((await json(unknownTemplate)).error, "unknown_template");

    const health = await json(await fetch(`${base}/motor/health`));
    assert.deepEqual(health, { ok: true });
    const healthBlob = JSON.stringify(health);
    assert.equal(healthBlob.includes("review"), false);
    assert.equal(healthBlob.includes("acl"), false);
    assert.equal(healthBlob.includes("draft"), false);
    assert.equal(readFileSync(journalFile, "utf8"), before.toString("utf8"));
  } finally {
    server.close();
  }

  const nucServer = createP2MotorServer({
    acl: ACL,
    journalDir: tempJournalDir(),
    resolveNode: async () => ({ stableId: NUC_ORCHESTRATOR_STABLE_ID, name: "nuc" }),
  });
  await new Promise<void>((resolve) => nucServer.listen(0, "127.0.0.1", resolve));
  const nucAddress = nucServer.address();
  assert.ok(nucAddress !== null && typeof nucAddress === "object");
  const nucBase = `http://127.0.0.1:${nucAddress.port}`;
  try {
    for (const path of ["/motor", "/api/motor/view?workspace=ws-motor"]) {
      const res = await fetch(`${nucBase}${path}`);
      assert.equal(res.status, 403);
      assert.equal((await json(res)).error, "node_not_allowed");
    }
    const nucWrite = await fetch(`${nucBase}/api/motor/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: "ws-motor",
        synthetic_template_id: "tpl-p21-review-reply",
      }),
    });
    assert.equal(nucWrite.status, 403);
    assert.equal((await json(nucWrite)).error, "node_not_allowed");
  } finally {
    nucServer.close();
  }

  const unknownServer = createP2MotorServer({
    acl: ACL,
    journalDir: tempJournalDir(),
    resolveNode: async () => null,
  });
  await new Promise<void>((resolve) => unknownServer.listen(0, "127.0.0.1", resolve));
  const unknownAddress = unknownServer.address();
  assert.ok(unknownAddress !== null && typeof unknownAddress === "object");
  const unknownBase = `http://127.0.0.1:${unknownAddress.port}`;
  try {
    for (const path of ["/motor", "/api/motor/view?workspace=ws-motor"]) {
      const res = await fetch(`${unknownBase}${path}`);
      assert.equal(res.status, 403);
      assert.equal((await json(res)).error, "node_not_allowed");
    }
  } finally {
    unknownServer.close();
  }

  const { server: foreignServer, base: foreignBase } = await listen();
  try {
    const foreign = await fetch(`${foreignBase}/api/motor/view?workspace=${OTHER_TENANT_ID}`);
    assert.equal(foreign.status, 403);
    const foreignHtml = await fetch(`${foreignBase}/motor/${OTHER_TENANT_ID}`);
    assert.equal(foreignHtml.status, 403);
  } finally {
    foreignServer.close();
  }
});
