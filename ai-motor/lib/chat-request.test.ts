import assert from "node:assert/strict";
import test from "node:test";
import { formatN8nChatError } from "@/lib/chat-n8n";
import { shouldUseBrowserTaskForAgent } from "@/lib/chat-request";

test("browser_task alleen bij actie-intent of browser-woorden", () => {
  assert.equal(shouldUseBrowserTaskForAgent("wat is ons marge?", "question"), false);
  assert.equal(
    shouldUseBrowserTaskForAgent("open website example.com", "question"),
    true
  );
  assert.equal(shouldUseBrowserTaskForAgent("bestel 10 stuks", "action"), true);
});

test("formatN8nChatError: status 0 is Nederlands en noemt host", () => {
  const err = formatN8nChatError({
    status: 0,
    webhookUrl: "http://127.0.0.1:5678/webhook/agent-mvp",
    fetchError: "The operation was aborted due to timeout",
  });
  assert.match(err.message, /n8n/i);
  assert.match(err.message, /127\.0\.0\.1:5678|n8n/i);
});
