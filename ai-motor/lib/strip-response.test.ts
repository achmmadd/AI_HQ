import assert from "node:assert/strict";
import test from "node:test";
import { stripChatOutput } from "@/lib/strip-response";

test("stripChatOutput: klant agent metadata", () => {
  const raw = "Klant: fumero · Agent: factory-os-agent\n\nHallo.";
  assert.equal(stripChatOutput(raw), "Hallo.");
});

test("stripChatOutput: bewaart inhoud als alleen headers gestript", () => {
  const raw = "## Live site-check\n\n## Live site-check\n\nKorte samenvatting.";
  assert.match(stripChatOutput(raw), /Korte samenvatting/);
});

test("stripChatOutput: duplicate live site-check title", () => {
  const raw =
    "## Live site-check\n\n## Live site-check\n\n- Eén punt\n- Twee";
  const out = stripChatOutput(raw);
  assert.equal((out.match(/Live site-check/gi) ?? []).length, 0);
  assert.match(out, /Eén punt/);
});
