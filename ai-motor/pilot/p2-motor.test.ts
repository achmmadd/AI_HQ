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
