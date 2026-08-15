import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseAcl } from "./server.ts";
import { createP2MotorServer } from "./p2-motor-server.ts";
import {
  designedOrchestratorAcl,
  evaluateOrchestratorProbe,
  isStableNodeId,
  NUC_ORCHESTRATOR_STABLE_ID,
  orchestratorAllowed,
  orchestratorBody,
  orchestratorBodyLeaks,
  P2_ORCHESTRATOR_HEALTH_URL,
  whoisStableId,
} from "./p2-orchestrator.ts";

const UI_ACL = parseAcl('{"nP2LAPTOP":["ws-motor"]}');
const ORCH_ACL = designedOrchestratorAcl();
const script = readFileSync(
  join(import.meta.dirname, "../infra/pilot/nuc/motor-p2-orchestrator.sh"),
  "utf8",
);
const workflow = readFileSync(join(import.meta.dirname, "../../.github/workflows/pilot-spine.yml"), "utf8");

async function listen(resolveId: string) {
  const server = createP2MotorServer({
    acl: UI_ACL,
    orchestratorAcl: ORCH_ACL,
    resolveNode: async () => ({ stableId: resolveId, name: "test" }),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("designed NUC orchestrator id is a StableID and not a hostname", () => {
  assert.equal(isStableNodeId(NUC_ORCHESTRATOR_STABLE_ID), true);
  assert.equal(isStableNodeId("motorai-nuc"), false);
  assert.equal(isStableNodeId("100.123.185.0"), false);
  assert.deepEqual(designedOrchestratorAcl(), { [NUC_ORCHESTRATOR_STABLE_ID]: ["ws-motor"] });
  assert.equal(orchestratorAllowed(NUC_ORCHESTRATOR_STABLE_ID, ORCH_ACL), true);
  assert.equal(orchestratorAllowed("nP2LAPTOP", ORCH_ACL), false);
  assert.equal(whoisStableId({ StableID: "", ID: NUC_ORCHESTRATOR_STABLE_ID }), NUC_ORCHESTRATOR_STABLE_ID);
  assert.equal(whoisStableId({ Name: "motorai-nuc" }), null);
});

test("orchestrator probe is disabled by default and pins the health URL", () => {
  assert.equal(evaluateOrchestratorProbe(P2_ORCHESTRATOR_HEALTH_URL, false).reason, "disabled");
  assert.deepEqual(evaluateOrchestratorProbe(P2_ORCHESTRATOR_HEALTH_URL, true), {
    ok: true,
    url: P2_ORCHESTRATOR_HEALTH_URL,
  });
  assert.equal(evaluateOrchestratorProbe("http://100.97.30.22:4420/motor", true).reason, "wrong_route");
  assert.equal(evaluateOrchestratorProbe("http://100.97.30.22:4420/motor/health", true).reason, "wrong_route");
});

test("NUC StableID may read orchestrator health; laptop may not", async () => {
  const nuc = await listen(NUC_ORCHESTRATOR_STABLE_ID);
  const laptop = await listen("nP2LAPTOP");
  try {
    const ok = await fetch(`${nuc.base}/motor/orchestrator/health`);
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as Record<string, unknown>;
    assert.deepEqual(body, { ok: true });
    assert.equal(orchestratorBodyLeaks(body), false);
    assert.deepEqual(orchestratorBody(), { ok: true });

    const ready = await fetch(`${nuc.base}/motor/orchestrator/ready`);
    assert.equal(ready.status, 200);

    const denied = await fetch(`${laptop.base}/motor/orchestrator/health`);
    assert.equal(denied.status, 403);

    const ui = await fetch(`${nuc.base}/motor`);
    assert.equal(ui.status, 403);

    const human = await fetch(`${laptop.base}/motor`);
    assert.equal(human.status, 200);
  } finally {
    nuc.server.close();
    laptop.server.close();
  }
});

test("empty orchestrator ACL is fail-closed even for the designed NUC id", async () => {
  const server = createP2MotorServer({
    acl: UI_ACL,
    orchestratorAcl: parseAcl("{}"),
    resolveNode: async () => ({ stableId: NUC_ORCHESTRATOR_STABLE_ID, name: "nuc" }),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/motor/orchestrator/health`);
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test("forwarded headers do not change WhoIs identity", async () => {
  const seen: string[] = [];
  const server = createP2MotorServer({
    acl: UI_ACL,
    orchestratorAcl: ORCH_ACL,
    resolveNode: async (ip) => {
      seen.push(ip);
      return { stableId: "nP2LAPTOP", name: "laptop" };
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  try {
    await fetch(`http://127.0.0.1:${address.port}/motor`, {
      headers: { "x-forwarded-for": "8.8.8.8", "x-real-ip": NUC_ORCHESTRATOR_STABLE_ID },
    });
    assert.equal(seen.some((ip) => ip === "8.8.8.8"), false);
    assert.equal(seen.every((ip) => ip === "127.0.0.1" || ip === "::1" || ip.endsWith("127.0.0.1")), true);
  } finally {
    server.close();
  }
});

test("orchestrator launcher is curl-only, disabled, and has no secrets", () => {
  assert.match(script, /MOTOR_P2_ORCHESTRATOR/);
  assert.match(script, /100\.97\.30\.22:4420\/motor\/orchestrator\/health/);
  assert.match(script, /curl /);
  assert.doesNotMatch(script, /chromium|firefox|docker |xinit|DISPLAY/);
  assert.doesNotMatch(script, /PILOT_STORE_SECRET|BEGIN [A-Z ]*PRIVATE KEY|sk-live/);
});

test("CI trigger includes this P2 branch and P2 infra paths", () => {
  assert.match(workflow, /pilot\/p2\.0-motor-kiosk/);
  assert.match(workflow, /ai-motor\/infra\/pilot\/nuc\/\*\*/);
  assert.match(workflow, /compose\.p2-motor\.yaml/);
  assert.match(workflow, /pilot\/\*\.test\.ts/);
});

test("NUC cannot use UI, review or publish; unknown node is denied everywhere gated", async () => {
  const nuc = await listen(NUC_ORCHESTRATOR_STABLE_ID);
  const unknown = await listen("nUNKNOWNCNTRL");
  const originalFetch = globalThis.fetch;
  let outbound = 0;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0]);
    if (url.startsWith(nuc.base) || url.startsWith(unknown.base)) return originalFetch(...args);
    outbound += 1;
    throw new Error(`unexpected outbound: ${url}`);
  };
  try {
    for (const path of ["/motor", "/api/motor/view?workspace=ws-motor", "/api/motor/evidence?workspace=ws-motor"]) {
      assert.equal((await fetch(`${nuc.base}${path}`)).status, 403);
    }
    for (const [path, body] of [
      ["/api/motor/review/submit", { workspace: "ws-motor", draftId: "draft-x" }],
      ["/api/motor/review/decide", { workspace: "ws-motor", draftId: "draft-x", decision: "approve" }],
      ["/api/motor/publish", { workspace: "ws-motor", draftId: "draft-x" }],
    ] as const) {
      const res = await fetch(`${nuc.base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 403);
    }
    assert.equal((await fetch(`${unknown.base}/motor`)).status, 403);
    assert.equal((await fetch(`${unknown.base}/motor/orchestrator/health`)).status, 403);
    assert.equal((await fetch(`${unknown.base}/motor/orchestrator/ready`)).status, 403);
    assert.equal(outbound, 0);
  } finally {
    globalThis.fetch = originalFetch;
    nuc.server.close();
    unknown.server.close();
  }
});

test("hostname or IP is never an orchestrator grant", () => {
  assert.equal(orchestratorAllowed("motorai-nuc", ORCH_ACL), false);
  assert.equal(orchestratorAllowed("motorai-server2", ORCH_ACL), false);
  assert.equal(orchestratorAllowed("100.123.185.0", ORCH_ACL), false);
  assert.equal(whoisStableId({ Name: "motorai-nuc", StableID: "motorai-nuc" }), null);
});

test("P0 :4400 contract files stay on PILOT_ACL and are not the P2 overlay", () => {
  const p0 = readFileSync(join(import.meta.dirname, "server.ts"), "utf8");
  const p0Compose = readFileSync(join(import.meta.dirname, "../infra/pilot/compose.yaml"), "utf8");
  const p2Compose = readFileSync(join(import.meta.dirname, "../infra/pilot/compose.p2-motor.yaml"), "utf8");
  assert.match(p0, /PILOT_API_PORT \?\? "4400"/);
  assert.match(p0, /parseAcl\(process\.env\.PILOT_ACL\)/);
  assert.match(p0Compose, /PILOT_ACL: \$\{PILOT_ACL:/);
  assert.match(p0Compose, /PILOT_API_PORT: "4400"/);
  assert.doesNotMatch(p0Compose, /PILOT_P2_ORCHESTRATOR_ACL/);
  assert.doesNotMatch(p2Compose, /PILOT_API_PORT: "4400"/);
  assert.match(p2Compose, /PILOT_P2_ORCHESTRATOR_ACL/);
});
