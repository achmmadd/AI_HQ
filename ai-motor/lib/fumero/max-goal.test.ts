import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMaxGoalCommand,
  bouwenClarifyingQuestions,
} from "@/lib/fumero/max-goal-shared";

test("parse /goal variants", () => {
  assert.deepEqual(parseMaxGoalCommand("/goal"), { action: "show" });
  assert.deepEqual(parseMaxGoalCommand("/goal clear"), { action: "clear" });
  assert.deepEqual(parseMaxGoalCommand("/goal add meer omzet"), {
    action: "add",
    text: "meer omzet",
  });
  assert.deepEqual(parseMaxGoalCommand("/goal Chatbot voor FAQ"), {
    action: "set",
    text: "Chatbot voor FAQ",
  });
  assert.equal(parseMaxGoalCommand("hallo"), null);
});

test("clarify: chatbot zonder bron", () => {
  const q = bouwenClarifyingQuestions("iets zodat klanten vragen kunnen stellen", null);
  assert.ok(q && q.length >= 1);
});
