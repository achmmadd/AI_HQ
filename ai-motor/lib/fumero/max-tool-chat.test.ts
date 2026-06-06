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

test("coder: informele bouw-wens → tool_build", () => {
  assert.equal(
    resolveMaxToolChatAction("iets op de site zodat klanten vragen kunnen stellen", {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: check ff → chat (geen template picker)", () => {
  assert.equal(isCoderQuestionOnly("check ff"), true);
  assert.equal(
    resolveMaxToolChatAction("check ff", {
      hasActiveTool: false,
      coderMode: true,
    }),
    null
  );
});

test("coder: kan je een chatbot maken → geen pure Q&A", () => {
  assert.equal(isCoderQuestionOnly("kan je een chatbot maken voor de shop"), false);
  assert.equal(
    resolveMaxToolChatAction("kan je een chatbot maken voor de shop", {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});
