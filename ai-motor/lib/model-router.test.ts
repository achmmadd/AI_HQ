import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_ROUTE_PRIORITY,
  formatRouteChain,
  resolveChatCompletionsUrl,
  resolveChatRoutingDecision,
  resolveLlmRouteChain,
  resolveOpenClawStreamRoute,
} from "@/lib/model-router";

const envBackup = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
});

test("CHAT_ROUTE_PRIORITY: openclaw before openrouter before n8n", () => {
  assert.deepEqual(CHAT_ROUTE_PRIORITY, ["openclaw", "openrouter", "n8n"]);
});

test("resolveChatCompletionsUrl: direct OpenRouter without LiteLLM", () => {
  delete process.env.LITELLM_BASE_URL;
  delete process.env.LITELLM_PROXY_URL;
  assert.equal(
    resolveChatCompletionsUrl(),
    "https://openrouter.ai/api/v1/chat/completions"
  );
});

test("resolveChatCompletionsUrl: LiteLLM proxy when configured", () => {
  process.env.LITELLM_BASE_URL = "http://hetzner-motor:4000/";
  assert.equal(
    resolveChatCompletionsUrl(),
    "http://hetzner-motor:4000/v1/chat/completions"
  );
});

test("resolveOpenClawStreamRoute: research → openrouter", () => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  const route = resolveOpenClawStreamRoute({
    klant: "bokas",
    agentMode: false,
    useResearchModel: true,
  });
  assert.equal(route.provider, "openrouter");
  if (route.provider === "openrouter") {
    assert.equal(route.research, true);
  }
});

test("resolveLlmRouteChain: openclaw → openrouter → n8n", () => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
  process.env.MOTORS_CHAT_USE_OPENCLAW = "1";
  process.env.MOTORS_CHAT_OPENROUTER_FALLBACK = "1";
  const chain = resolveLlmRouteChain({
    klant: "fumero",
    agentMode: false,
    useResearchModel: false,
  });
  assert.deepEqual(chain, ["openclaw", "openrouter", "n8n"]);
});

test("resolveChatRoutingDecision: logs planned model for fumero flash", () => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  process.env.FUMERO_CHAT_FAST_PATH = "1";
  process.env.FUMERO_CHAT_MODEL = "deepseek/deepseek-v4-flash";
  const decision = resolveChatRoutingDecision(
    { klant: "fumero", agentMode: false, useResearchModel: false, fumeroModelTier: "flash" },
    { includeLocalExecutor: true }
  );
  assert.equal(decision.primaryProvider, "openrouter");
  assert.equal(decision.fastPath, "fumero_openrouter_direct");
  assert.equal(decision.routeChain[0], "local_executor");
  assert.ok(formatRouteChain(decision.routeChain).includes("nuc-local-executor"));
});
