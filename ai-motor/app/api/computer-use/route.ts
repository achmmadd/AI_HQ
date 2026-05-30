import { NextResponse } from "next/server";
import { N8N_FACTORY_WEBHOOK } from "@/lib/chat-n8n";
import { isBrowserbaseConfigured } from "@/lib/browserbase-client";
import { getComputerUseViewerUrl } from "@/lib/computer-use-config";
import {
  explicitAgentWebhookFromEnv,
  isMisconfiguredAgentUrl,
  resolveAgentChatRoutingSource,
  resolveChatWebhookUrl,
} from "@/lib/intent-detection";

export const runtime = "nodejs";

/** Config voor Agent-paneel (geen secrets, geen bearer-waarden). */
export async function GET() {
  const computerUseRaw = process.env.COMPUTER_USE_URL?.trim() ?? "";
  const webhookConfigured = Boolean(computerUseRaw);
  const computerUseMisconfigured =
    webhookConfigured && isMisconfiguredAgentUrl(computerUseRaw);
  const explicitHook = Boolean(explicitAgentWebhookFromEnv());
  /** `COMPUTER_USE_URL` wordt echt als agent-chat-webhook gebruikt. */
  const chatWebhookDedicated =
    explicitHook ||
    (webhookConfigured && !computerUseMisconfigured);
  const viewerUrl = getComputerUseViewerUrl();
  const screenshotConfigured = Boolean(
    process.env.COMPUTER_USE_SCREENSHOT_URL?.trim()
  );
  const screenshotAuthConfigured = Boolean(
    process.env.COMPUTER_USE_SCREENSHOT_BEARER_TOKEN?.trim() ||
      process.env.COMPUTER_USE_SCREENSHOT_HEADERS_JSON?.trim()
  );
  const screenshotPostConfigured = Boolean(
    process.env.COMPUTER_USE_SCREENSHOT_METHOD?.trim() ||
      process.env.COMPUTER_USE_SCREENSHOT_POST_BODY?.trim()
  );

  /** Zelfde velden als Factory-n8n body (`lib/chat-n8n` → CallFactoryN8nInput). */
  const chatWebhookPayloadHint = [
    "prompt (string)",
    "klant (string)",
    "afdeling (string)",
    "agent_mode (boolean) — true in Agent-modus",
    "context (array van { role, content })",
    'intent ("action" | "question" | "build")',
    " (+ eventueel extra sleutels die je workflow gebruikt)",
  ];

  const resolvedAgentUrl = resolveChatWebhookUrl("question", {
    agentMode: true,
  });
  const agentChatRouting = resolveAgentChatRoutingSource();

  return NextResponse.json({
    configured: webhookConfigured || Boolean(viewerUrl),
    webhookConfigured,
    /** Eigen agent-webhook (N8N_AGENT_* of geldige COMPUTER_USE_URL) vóór Factory-default. */
    chatWebhookDedicated,
    computerUseMisconfigured,
    explicitAgentWebhookConfigured: explicitHook,
    /** `factory` = Factory-webhook met `agent_mode` (standaard; volledig ondersteund). */
    agentChatRouting,
    agentChatUsesFactoryWebhook: resolvedAgentUrl === N8N_FACTORY_WEBHOOK,
    resolvedAgentWebhookPathname: (() => {
      try {
        return new URL(resolvedAgentUrl).pathname;
      } catch {
        return null;
      }
    })(),
    viewerUrl,
    viewerUsesPublicFallback: Boolean(
      !process.env.COMPUTER_USE_VIEWER_URL?.trim() &&
        process.env.NEXT_PUBLIC_COMPUTER_USE_VIEWER_URL?.trim()
    ),
    screenshotConfigured,
    screenshotAuthConfigured,
    screenshotPostConfigured,
    browserbaseConfigured: isBrowserbaseConfigured(),
    browserbaseProjectIdConfigured: Boolean(
      process.env.BROWSERBASE_PROJECT_ID?.trim()
    ),
    chatWebhookPayloadHint,
  });
}
