import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CODE_MODEL_HEAVY,
  PARETO_CODE_MODEL,
  resolveCodeModelForTurn,
} from "./code-models";

test("resolveCodeModelForTurn routes light edits to pareto", () => {
  const prev = process.env.MOTOR_CODE_MODEL;
  delete process.env.MOTOR_CODE_MODEL;
  assert.equal(
    resolveCodeModelForTurn(
      { message: "fix typo in README" },
      "openrouter"
    ),
    PARETO_CODE_MODEL
  );
  if (prev === undefined) delete process.env.MOTOR_CODE_MODEL;
  else process.env.MOTOR_CODE_MODEL = prev;
});

test("resolveCodeModelForTurn routes heavy turns to sonnet", () => {
  const prev = process.env.MOTOR_CODE_MODEL;
  delete process.env.MOTOR_CODE_MODEL;
  assert.equal(
    resolveCodeModelForTurn(
      { message: "refactor the auth module across multiple files" },
      "openrouter"
    ),
    DEFAULT_CODE_MODEL_HEAVY
  );
  if (prev === undefined) delete process.env.MOTOR_CODE_MODEL;
  else process.env.MOTOR_CODE_MODEL = prev;
});

test("resolveCodeModelForTurn respects MOTOR_CODE_MODEL override", () => {
  const prev = process.env.MOTOR_CODE_MODEL;
  process.env.MOTOR_CODE_MODEL = "custom/model";
  assert.equal(
    resolveCodeModelForTurn({ message: "anything" }, "openrouter"),
    "custom/model"
  );
  if (prev === undefined) delete process.env.MOTOR_CODE_MODEL;
  else process.env.MOTOR_CODE_MODEL = prev;
});
