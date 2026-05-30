import assert from "node:assert/strict";
import test from "node:test";
import { shouldRunChatWebResearch } from "@/lib/chat-web-research";

const envBackup = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
});

test("shouldRunChatWebResearch: zoek-op intent", () => {
  assert.equal(
    shouldRunChatWebResearch("Zoek op wat Bokas vandaag op het menu heeft"),
    true
  );
});

test("shouldRunChatWebResearch: URL in prompt", () => {
  assert.equal(
    shouldRunChatWebResearch("Wat staat op https://bokas.nl/menu/?"),
    true
  );
});

test("shouldRunChatWebResearch: uit te zetten via env", () => {
  process.env.MOTORS_CHAT_WEB_RESEARCH = "0";
  assert.equal(shouldRunChatWebResearch("zoek op iets"), false);
});

test("shouldRunChatWebResearch: gewone vraag niet", () => {
  assert.equal(
    shouldRunChatWebResearch("Schrijf een korte e-mail naar de leverancier"),
    false
  );
});
