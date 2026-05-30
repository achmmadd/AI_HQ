import assert from "node:assert/strict";
import test from "node:test";
import { N8N_FACTORY_WEBHOOK } from "@/lib/chat-n8n";
import {
  resolveAgentChatRoutingSource,
  resolveChatWebhookTarget,
} from "@/lib/intent-detection";

const envBackup = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
}

test.afterEach(() => {
  restoreEnv();
});

test("agent-modus: Factory-webhook met kind agent zonder agent-env", () => {
  delete process.env.N8N_AGENT_WEBHOOK;
  delete process.env.N8N_AGENT_CHAT_WEBHOOK;
  delete process.env.MOTOR_AGENT_CHAT_WEBHOOK;
  delete process.env.COMPUTER_USE_URL;
  const r = resolveChatWebhookTarget("question", { agentMode: true });
  assert.equal(r.url, N8N_FACTORY_WEBHOOK);
  assert.equal(r.kind, "agent");
  assert.equal(resolveAgentChatRoutingSource(), "factory");
});

test("agent-modus: kale API-root als COMPUTER_USE_URL wordt genegeerd", () => {
  delete process.env.N8N_AGENT_WEBHOOK;
  process.env.COMPUTER_USE_URL = "https://api.example.com/v1";
  const r = resolveChatWebhookTarget("question", { agentMode: true });
  assert.equal(r.url, N8N_FACTORY_WEBHOOK);
  assert.equal(r.kind, "agent");
  assert.equal(resolveAgentChatRoutingSource(), "factory");
});

test("agent-modus: volgt N8N_AGENT_WEBHOOK", () => {
  delete process.env.COMPUTER_USE_URL;
  process.env.N8N_AGENT_WEBHOOK = "http://localhost:9999/webhook/agent";
  const r = resolveChatWebhookTarget("question", { agentMode: true });
  assert.equal(r.url, "http://localhost:9999/webhook/agent");
  assert.equal(r.kind, "agent");
  assert.equal(resolveAgentChatRoutingSource(), "explicit");
  delete process.env.N8N_AGENT_WEBHOOK;
});

test("agent-modus: geldige COMPUTER_USE_URL wint", () => {
  process.env.COMPUTER_USE_URL = "http://127.0.0.1:5678/webhook/custom-agent";
  const r = resolveChatWebhookTarget("question", { agentMode: true });
  assert.equal(r.url, "http://127.0.0.1:5678/webhook/custom-agent");
  assert.equal(r.kind, "agent");
  assert.equal(resolveAgentChatRoutingSource(), "computer_use");
});

test("gewone chat: geen entrepreneur → factory", () => {
  delete process.env.N8N_ENTREPRENEUR_WEBHOOK;
  delete process.env.N8N_ENTREPRENEUR_AGENT_WEBHOOK;
  const r = resolveChatWebhookTarget("question", { agentMode: false });
  assert.equal(r.kind, "factory");
});
