import assert from "node:assert/strict";
import test from "node:test";
import {
  isLocalChatEnabled,
  shouldRouteChatViaOpenClaw,
  shouldUseFumeroOpenRouterFastPath,
  shouldUseOpenRouterFastPath,
  shouldUseResearchModelPath,
  useRichChatContextForKlant,
} from "@/lib/chat-routing-policy";

const envBackup = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
});

test("shouldRouteChatViaOpenClaw: altijd bij agent", () => {
  delete process.env.MOTORS_CHAT_USE_OPENCLAW;
  assert.equal(
    shouldRouteChatViaOpenClaw({ agentMode: true }),
    true
  );
});

test("shouldUseOpenRouterFastPath: standaard uit", () => {
  delete process.env.MOTORS_CHAT_FAST_PATH;
  process.env.OPENROUTER_API_KEY = "sk-test";
  assert.equal(shouldUseOpenRouterFastPath({ agentMode: false }), false);
});

test("shouldUseOpenRouterFastPath: aan bij MOTORS_CHAT_FAST_PATH=1", () => {
  process.env.MOTORS_CHAT_FAST_PATH = "1";
  process.env.OPENROUTER_API_KEY = "sk-test";
  assert.equal(shouldUseOpenRouterFastPath({ agentMode: false }), true);
});

test("shouldUseResearchModelPath bij web intent", () => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  assert.equal(shouldUseResearchModelPath(true), true);
});

test("isLocalChatEnabled default aan", () => {
  delete process.env.MOTORS_LOCAL_CHAT;
  assert.equal(isLocalChatEnabled(), true);
});

test("shouldUseFumeroOpenRouterFastPath: uit zonder env", () => {
  delete process.env.FUMERO_CHAT_FAST_PATH;
  delete process.env.FUMERO_CHAT_MODEL;
  process.env.OPENROUTER_API_KEY = "sk-test";
  assert.equal(
    shouldUseFumeroOpenRouterFastPath("fumero", { agentMode: false }),
    false
  );
});

test("shouldUseFumeroOpenRouterFastPath: aan bij FUMERO_CHAT_FAST_PATH=1", () => {
  process.env.FUMERO_CHAT_FAST_PATH = "1";
  process.env.OPENROUTER_API_KEY = "sk-test";
  assert.equal(
    shouldUseFumeroOpenRouterFastPath("fumero", { agentMode: false }),
    true
  );
  assert.equal(
    shouldUseFumeroOpenRouterFastPath("bokas", { agentMode: false }),
    false
  );
});

test("useRichChatContextForKlant: FUMERO_CHAT_RICH_CONTEXT=0", () => {
  process.env.MOTORS_CHAT_RICH_CONTEXT = "1";
  process.env.FUMERO_CHAT_RICH_CONTEXT = "0";
  assert.equal(useRichChatContextForKlant("fumero"), false);
  assert.equal(useRichChatContextForKlant("bokas"), true);
});
