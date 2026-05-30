import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_JUNIOR_MODEL,
  DEFAULT_RESEARCH_MODEL,
  getFumeroChatModelId,
  getOpenRouterChatModelId,
  resolveOpenRouterModelForTurn,
} from "@/lib/chat-models";

const envBackup = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
});

test("defaults zijn v4-pro en sonar-pro", () => {
  delete process.env.CHAT_MODEL;
  delete process.env.JUNIOR_MODEL;
  assert.equal(getOpenRouterChatModelId(), DEFAULT_CHAT_MODEL);
  assert.equal(
    resolveOpenRouterModelForTurn({ research: true }),
    DEFAULT_RESEARCH_MODEL
  );
});

test("CHAT_MODEL override", () => {
  process.env.CHAT_MODEL = "anthropic/claude-sonnet-4";
  assert.equal(getOpenRouterChatModelId(), "anthropic/claude-sonnet-4");
});

test("FUMERO_CHAT_MODEL override", () => {
  process.env.FUMERO_CHAT_MODEL = "deepseek/deepseek-v4-flash";
  assert.equal(getFumeroChatModelId(), "deepseek/deepseek-v4-flash");
});

test("getFumeroChatModelId default flash", () => {
  delete process.env.FUMERO_CHAT_MODEL;
  delete process.env.JUNIOR_MODEL;
  assert.equal(getFumeroChatModelId(), DEFAULT_JUNIOR_MODEL);
});
