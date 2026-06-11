import assert from "node:assert/strict";
import test from "node:test";
import {
  detectFullAppIntent,
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

test("coder: projectmanagement portaal scope → full_app", () => {
  const prompt =
    "Maak een projectmanagement portaal met dashboard, detailpagina's, admin-overzicht, klanten, projecten, taken, rollen en login.";

  assert.equal(detectFullAppIntent(prompt), true);
});

test("coder: CRM/customer portal scope → full_app", () => {
  assert.equal(
    detectFullAppIntent(
      "Bouw een CRM customer portal waar clients orders kunnen bekijken en admins klanten beheren."
    ),
    true
  );
});

test("coder: simpele calculator blijft tool_build", () => {
  const prompt = "bouw een simpele calculator voor op de website";

  assert.equal(detectFullAppIntent(prompt), false);
  assert.equal(
    resolveMaxToolChatAction(prompt, {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: website-chatbot blijft widget/tool zonder app-scope", () => {
  const prompt = "maak een chatbot voor vragen op mijn website";

  assert.equal(detectFullAppIntent(prompt), false);
  assert.equal(
    resolveMaxToolChatAction(prompt, {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: landingspagina → tool_build", () => {
  const prompt = "maak een landingspagina voor mijn kapsalon";

  assert.equal(detectFullAppIntent(prompt), false);
  assert.equal(
    resolveMaxToolChatAction(prompt, {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: bestelformulier → tool_build", () => {
  assert.equal(
    resolveMaxToolChatAction("bouw een bestelformulier met naam en e-mail", {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: eenvoudig dashboard blijft tool (geen full_app)", () => {
  const prompt = "bouw een eenvoudig dashboard met KPI-tegels";

  assert.equal(detectFullAppIntent(prompt), false);
  assert.equal(
    resolveMaxToolChatAction(prompt, {
      hasActiveTool: false,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});

test("coder: admin dashboard met klanten → full_app", () => {
  const prompt =
    "maak een dashboard voor admins om klanten en orders te beheren";

  assert.equal(detectFullAppIntent(prompt), true);
});

test("coder: ok zonder clarify-context → null (geen lege build)", () => {
  assert.equal(
    resolveMaxToolChatAction("ok", {
      hasActiveTool: false,
      coderMode: true,
    }),
    null
  );
});

test("coder: ga door met awaitingClarify → tool_build", () => {
  assert.equal(
    resolveMaxToolChatAction("ga door", {
      hasActiveTool: false,
      awaitingClarify: true,
      coderMode: true,
    })?.type,
    "tool_build"
  );
});
