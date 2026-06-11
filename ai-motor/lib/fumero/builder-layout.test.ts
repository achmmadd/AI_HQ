import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILDER_CHAT_DEFAULT_PERCENT,
  BUILDER_CHAT_MAX_PERCENT,
  BUILDER_CHAT_MIN_PX,
  builderChatPercentFromKeyboard,
  builderChatPercentFromPointer,
  clampBuilderChatPercent,
  normalizeStoredBuilderChatPercent,
} from "@/lib/fumero/builder-layout";

test("builder splitter clamps chat width between minimum pixels and max percent", () => {
  assert.equal(clampBuilderChatPercent(10, 1200), (BUILDER_CHAT_MIN_PX / 1200) * 100);
  assert.equal(clampBuilderChatPercent(60, 1200), BUILDER_CHAT_MAX_PERCENT);
  assert.equal(clampBuilderChatPercent(32, 1200), 32);
});

test("builder splitter derives saved width from pointer position", () => {
  assert.ok(Math.abs(builderChatPercentFromPointer(336, 0, 1200) - 28) < 0.001);
  assert.equal(builderChatPercentFromPointer(100, 0, 1200), (BUILDER_CHAT_MIN_PX / 1200) * 100);
  assert.equal(builderChatPercentFromPointer(900, 0, 1200), BUILDER_CHAT_MAX_PERCENT);
});

test("builder splitter restores stored width safely", () => {
  assert.equal(normalizeStoredBuilderChatPercent("34", 1200), 34);
  assert.equal(normalizeStoredBuilderChatPercent("bad", 1200), BUILDER_CHAT_DEFAULT_PERCENT);
  assert.equal(normalizeStoredBuilderChatPercent(null, 1200), BUILDER_CHAT_DEFAULT_PERCENT);
});

test("builder splitter supports keyboard resizing and reset", () => {
  assert.equal(builderChatPercentFromKeyboard(30, "ArrowRight", 1200), 32);
  assert.equal(builderChatPercentFromKeyboard(30, "ArrowLeft", 1200), 28);
  assert.equal(builderChatPercentFromKeyboard(30, "Home", 1200), BUILDER_CHAT_DEFAULT_PERCENT);
  assert.equal(builderChatPercentFromKeyboard(30, "End", 1200), BUILDER_CHAT_MAX_PERCENT);
  assert.equal(builderChatPercentFromKeyboard(30, "Tab", 1200), 30);
});
