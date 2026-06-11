import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClarifyAckMessage,
  looksLikeBuildCodeInChat,
  sanitizeBuildChatContent,
} from "@/lib/fumero/chat-build-guard";

test("detects html fence in chat", () => {
  assert.equal(
    looksLikeBuildCodeInChat("Hier is je widget:\n```html\n<!DOCTYPE html><html></html>\n```"),
    true
  );
});

test("detects raw html document in chat", () => {
  assert.equal(
    looksLikeBuildCodeInChat("<!DOCTYPE html><html><body><p>hi</p></body></html>"),
    true
  );
});

test("sanitize strips code and keeps prose", () => {
  const out = sanitizeBuildChatContent(
    "Top idee.\n\n```html\n<!DOCTYPE html><html><body>x</body></html>\n```"
  );
  assert.match(out, /Top idee/);
  assert.doesNotMatch(out, /<!DOCTYPE/);
});

test("sanitize replaces code-only bubble", () => {
  const out = sanitizeBuildChatContent(
    "```html\n<!DOCTYPE html><html><head></head><body><div id=\"app\"></div></body></html>\n```"
  );
  assert.doesNotMatch(out, /<!DOCTYPE/);
  assert.match(out, /previewpaneel/i);
});

test("clarify ack mentions ga door", () => {
  assert.match(formatClarifyAckMessage(), /ga door/i);
});
