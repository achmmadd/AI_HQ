import assert from "node:assert/strict";
import test from "node:test";
import {
  isCoderQuestionOnly,
  resolveMaxToolChatAction,
} from "@/lib/fumero/max-tool-chat";

test("coder: bouw een rekenmachine → tool_build", () => {
  assert.equal(
    resolveMaxToolChatAction("bouw een rekenmachine", {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: wat is flash → null (Q&A)", () => {
  assert.equal(
    resolveMaxToolChatAction("wat is flash?", {
      hasActiveTool: false,
      coderMode: true,
    }),
    null
  );
  assert.equal(isCoderQuestionOnly("wat is flash?"), true);
});

test("coder: niet-vraag zonder template → tool_build", () => {
  assert.equal(
    resolveMaxToolChatAction("bouw iets voor de shop", {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: actieve tool → iterate", () => {
  assert.equal(
    resolveMaxToolChatAction("hallo", {
      hasActiveTool: true,
      coderMode: true,
    })?.type,
    "tool_iterate"
  );
});
