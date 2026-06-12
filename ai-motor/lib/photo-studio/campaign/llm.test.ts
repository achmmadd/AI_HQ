import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignLlmTimeoutMs,
  isCampaignTemplateOnly,
} from "@/lib/photo-studio/campaign/llm";

test("campaignLlmTimeoutMs defaults to 25s and caps at 30s", () => {
  delete process.env.CAMPAIGN_LLM_TIMEOUT_MS;
  assert.equal(campaignLlmTimeoutMs(), 25_000);
  process.env.CAMPAIGN_LLM_TIMEOUT_MS = "120000";
  assert.equal(campaignLlmTimeoutMs(), 30_000);
  process.env.CAMPAIGN_LLM_TIMEOUT_MS = "8000";
  assert.equal(campaignLlmTimeoutMs(), 8000);
  delete process.env.CAMPAIGN_LLM_TIMEOUT_MS;
});

test("isCampaignTemplateOnly respects explicit env", () => {
  const prevNode = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.CAMPAIGN_TEMPLATE_ONLY;
  assert.equal(isCampaignTemplateOnly(), false);
  process.env.CAMPAIGN_TEMPLATE_ONLY = "1";
  assert.equal(isCampaignTemplateOnly(), true);
  process.env.CAMPAIGN_TEMPLATE_ONLY = "0";
  assert.equal(isCampaignTemplateOnly(), false);
  process.env.NODE_ENV = "development";
  delete process.env.CAMPAIGN_TEMPLATE_ONLY;
  assert.equal(isCampaignTemplateOnly(), true);
  process.env.CAMPAIGN_TEMPLATE_ONLY = "0";
  assert.equal(isCampaignTemplateOnly(), false);
  process.env.NODE_ENV = prevNode;
  delete process.env.CAMPAIGN_TEMPLATE_ONLY;
});
