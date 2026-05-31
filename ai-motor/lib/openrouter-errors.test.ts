import assert from "node:assert/strict";
import test from "node:test";
import {
  formatOpenRouterUserError,
  getOpenRouterFallbackModel,
  isOpenRouterRateLimited,
  OPENROUTER_RATE_LIMIT_USER_MESSAGE,
} from "./openrouter-errors";

test("isOpenRouterRateLimited detects 429 body", () => {
  assert.equal(
    isOpenRouterRateLimited(
      429,
      "qwen/qwen3.7-max is temporarily rate-limited upstream"
    ),
    true
  );
});

test("formatOpenRouterUserError maps OpenRouter 429", () => {
  assert.equal(
    formatOpenRouterUserError(
      "OpenRouter 429: qwen/qwen3.7-max is temporarily rate-limited upstream (Alibaba)"
    ),
    OPENROUTER_RATE_LIMIT_USER_MESSAGE
  );
});

test("getOpenRouterFallbackModel respects env", () => {
  const prev = process.env.OPENROUTER_FALLBACK_MODEL;
  process.env.OPENROUTER_FALLBACK_MODEL = "anthropic/claude-sonnet-4.6";
  assert.equal(getOpenRouterFallbackModel(), "anthropic/claude-sonnet-4.6");
  if (prev === undefined) delete process.env.OPENROUTER_FALLBACK_MODEL;
  else process.env.OPENROUTER_FALLBACK_MODEL = prev;
});
