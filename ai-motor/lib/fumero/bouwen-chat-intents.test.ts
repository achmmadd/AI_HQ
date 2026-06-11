import assert from "node:assert/strict";
import test from "node:test";
import {
  isBouwenClarifyAnswerWithBuild,
  isBouwenContinueIntent,
  isPreviewPanelOpenIntent,
  mergeBouwenClarifyPrompt,
} from "@/lib/fumero/bouwen-chat-intents";
import { resolveMaxToolChatAction } from "@/lib/fumero/max-tool-chat";

test("ga door is continue intent", () => {
  assert.equal(isBouwenContinueIntent("ga door"), true);
  assert.equal(isBouwenContinueIntent("Ga door."), true);
  assert.equal(isBouwenContinueIntent("bouwen"), true);
  assert.equal(isBouwenContinueIntent("doe maar"), true);
});

test("inline continue in long clarify answer", () => {
  assert.equal(
    isBouwenContinueIntent("gebruik faq en shop van fumero.nl, ga door"),
    true
  );
  assert.equal(isBouwenClarifyAnswerWithBuild("faq info, ga door"), true);
});

test("preview open phrases", () => {
  assert.equal(isPreviewPanelOpenIntent("open het in preview panel"), true);
  assert.equal(isPreviewPanelOpenIntent("open preview"), true);
  assert.equal(isPreviewPanelOpenIntent("preview"), true);
  assert.equal(isPreviewPanelOpenIntent("preview paneel"), true);
  assert.equal(isPreviewPanelOpenIntent("maak een chatbot"), false);
});

test("merge clarify drops bare ga door", () => {
  assert.equal(
    mergeBouwenClarifyPrompt("maak chatbot", ["faq van fumero.nl"], "ga door"),
    "maak chatbot\n\nfaq van fumero.nl"
  );
});

test("coder: ga door without clarify context → null", () => {
  assert.equal(
    resolveMaxToolChatAction("ga door", {
      hasActiveTool: false,
      coderMode: true,
    }),
    null
  );
  assert.equal(
    resolveMaxToolChatAction("ok", {
      hasActiveTool: false,
      coderMode: true,
    }),
    null
  );
});

test("coder: ga door with awaiting clarify → tool_build", () => {
  assert.equal(
    resolveMaxToolChatAction("ga door", {
      hasActiveTool: false,
      awaitingClarify: true,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: open preview with artifact → open_preview", () => {
  assert.equal(
    resolveMaxToolChatAction("open het in preview panel", {
      hasActiveTool: true,
      hasPreview: true,
      coderMode: true,
    })?.type,
    "open_preview"
  );
});

test("coder: active tool + preview beats iterate", () => {
  assert.equal(
    resolveMaxToolChatAction("preview", {
      hasActiveTool: true,
      hasPreview: true,
      coderMode: true,
    })?.type,
    "open_preview"
  );
});

test("awaiting clarify: antwoord zonder ga door → null", () => {
  assert.equal(
    resolveMaxToolChatAction("faq van fumero.nl", {
      hasActiveTool: false,
      awaitingClarify: true,
      coderMode: true,
    }),
    null
  );
});

test("embeddable chatbot one-liner → tool_build", () => {
  const prompt =
    "Bouw een embeddable klantenservice chatbot voor fumero.nl met quick replies";
  assert.equal(
    resolveMaxToolChatAction(prompt, {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});
