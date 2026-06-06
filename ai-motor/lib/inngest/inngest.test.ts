import assert from "node:assert/strict";
import test from "node:test";
import {
  isInngestConfigured,
  sendInngestEvent,
} from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import {
  relayN8nWebhookToInngest,
  resolveN8nBridgeWebhookUrl,
} from "@/lib/inngest/n8n-bridge";

const envBackup = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
});

test("isInngestConfigured: false without keys", () => {
  delete process.env.INNGEST_EVENT_KEY;
  delete process.env.INNGEST_SIGNING_KEY;
  delete process.env.INNGEST_DEV;
  assert.equal(isInngestConfigured(), false);
});

test("isInngestConfigured: true with Cloud keys", () => {
  process.env.INNGEST_EVENT_KEY = "evt_test";
  process.env.INNGEST_SIGNING_KEY = "signkey_test";
  assert.equal(isInngestConfigured(), true);
});

test("sendInngestEvent: no-op when not configured", async () => {
  delete process.env.INNGEST_EVENT_KEY;
  delete process.env.INNGEST_SIGNING_KEY;
  delete process.env.INNGEST_DEV;
  const result = await sendInngestEvent(INNGEST_EVENTS.approvalRequested, {
    approvalId: 1,
    title: "test",
    action: "noop",
  });
  assert.equal(result.sent, false);
  assert.equal(result.skipped, true);
});

test("relayN8nWebhookToInngest: skipped when Inngest off", async () => {
  delete process.env.INNGEST_EVENT_KEY;
  delete process.env.INNGEST_SIGNING_KEY;
  const result = await relayN8nWebhookToInngest({
    workflow: "factory",
    runId: "run-1",
  });
  assert.equal(result.inngest.sent, false);
});

test("resolveN8nBridgeWebhookUrl: prefers agent webhook", () => {
  process.env.N8N_AGENT_WEBHOOK = "http://n8n/agent";
  process.env.N8N_FACTORY_WEBHOOK = "http://n8n/factory";
  assert.equal(resolveN8nBridgeWebhookUrl(), "http://n8n/agent");
});
