import { NextResponse } from "next/server";
import { N8N_FACTORY_WEBHOOK } from "@/lib/chat-n8n";
import {
  explicitAgentWebhookFromEnv,
  isMisconfiguredAgentUrl,
  resolveChatWebhookTarget,
  resolveChatWebhookUrl,
} from "@/lib/intent-detection";
import { assertDifyConfigured } from "@/lib/artifact-html";
import { getComputerUseViewerUrl } from "@/lib/computer-use-config";
import {
  fetchLocalExecutorHealth,
  isLocalExecutorConfigured,
} from "@/lib/local-executor";

export const runtime = "nodejs";

/**
 * Publieke readiness (geen secret-waarden): Agent routing, computer-use hooks, geheugen-stack.
 */
export async function GET() {
  const computerUseRaw = process.env.COMPUTER_USE_URL?.trim() ?? "";
  const computerUseUrl = Boolean(computerUseRaw);
  const explicitAgent = Boolean(explicitAgentWebhookFromEnv());
  const validDedicatedComputerUse =
    computerUseRaw.length > 0 && !isMisconfiguredAgentUrl(computerUseRaw);
  /** Eigen webhook-URL voor agent-chat (geen Browserbase-/v1-root). */
  const agentDedicatedWebhookConfigured =
    explicitAgent || validDedicatedComputerUse;

  const agentTarget = resolveChatWebhookTarget("question", { agentMode: true });
  const agentModeUsesAgentChannel = agentTarget.kind === "agent";
  const sampleAgentWebhook = resolveChatWebhookUrl("question", {
    agentMode: true,
  });
  const agentRoutesViaFactoryOs =
    sampleAgentWebhook === N8N_FACTORY_WEBHOOK;

  const screenshotUrl = Boolean(process.env.COMPUTER_USE_SCREENSHOT_URL?.trim());
  const viewerUrl = Boolean(getComputerUseViewerUrl());
  const streamIngest = Boolean(process.env.AGENT_STREAM_SECRET?.trim());
  const localExecutorConfigured = isLocalExecutorConfigured();
  const localExecutorHealth = localExecutorConfigured
    ? await fetchLocalExecutorHealth()
    : null;

  const notes: string[] = [];
  notes.push(
    "Agent-modus stuurt `agent_mode:true` naar n8n. Zonder `N8N_AGENT_WEBHOOK` of geldige `COMPUTER_USE_URL` gebruikt MotorsAI de Factory-webhook — dat is de standaard (volledig ondersteund)."
  );
  if (!process.env.FAL_API_KEY?.trim() && !process.env.FAL_KEY?.trim()) {
    notes.push("Studio / fal: zet FAL_API_KEY (of FAL_KEY) voor Kontext en productfoto’s.");
  }
  if (!assertDifyConfigured() && !process.env.OPENROUTER_API_KEY?.trim()) {
    notes.push(
      "HTML-builder: zet DIFY_API_KEY (lokaal Dify) of OPENROUTER_API_KEY (qwen fallback). n8n Factory is laatste fallback. Anthropic builder uit tenzij MOTOR_BUILDER_USE_ANTHROPIC=1."
    );
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    notes.push(
      "Zonder ANTHROPIC_API_KEY: geen web+vision design-onderzoek vóór HTML-build; Qdrant-geheugen-ingest na chat-turns valt ook weg."
    );
  }

  const gh = process.env.GITHUB_TOKEN?.trim();
  const vz = process.env.VERCEL_TOKEN?.trim();
  if (!gh || !vz) {
    notes.push(
      "Deploy-knop: zet GITHUB_TOKEN en VERCEL_TOKEN (plus Vercel↔GitHub-koppeling) om /api/apps/deploy te gebruiken."
    );
  }
  if (
    !process.env.N8N_FACTORY_OS_WEBHOOK?.trim() &&
    !process.env.N8N_FACTORY_WEBHOOK?.trim()
  ) {
    notes.push(
      "Chat (niet-builder): er is geen N8N_FACTORY_OS_WEBHOOK of N8N_FACTORY_WEBHOOK gezet — default is http://127.0.0.1:5678/webhook/factory-os"
    );
  }

  const missingRecommended: string[] = [];
  if (!assertDifyConfigured()) {
    missingRecommended.push(
      "DIFY_API_KEY | DIFY_CODE_INTERPRETER_API_KEY | DIFY_SOCIAL_API_KEY (vereist: HTML builder in /chat)"
    );
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    missingRecommended.push(
      "ANTHROPIC_API_KEY (aanbevolen: design research + geheugen na chat)"
    );
  }
  if (!gh) missingRecommended.push("GITHUB_TOKEN (vereist: artifact Deploy)");
  if (!vz) missingRecommended.push("VERCEL_TOKEN (vereist: artifact Deploy)");
  if (
    !process.env.N8N_FACTORY_OS_WEBHOOK?.trim() &&
    !process.env.N8N_FACTORY_WEBHOOK?.trim()
  ) {
    missingRecommended.push(
      "N8N_FACTORY_WEBHOOK of N8N_FACTORY_OS_WEBHOOK (aanbevolen als n8n niet op localhost:5678 draait)"
    );
  }
  if (!process.env.MOTORSAI_PASSWORD?.trim()) {
    missingRecommended.push("MOTORSAI_PASSWORD (login; default demo in dev — zet in productie)");
  }
  if (!localExecutorConfigured) {
    notes.push(
      "NUC-local acties: zet LOCAL_EXECUTOR_URL + LOCAL_EXECUTOR_SECRET en start ./run_executor.sh in agent_service (poort 8790)."
    );
  } else if (localExecutorHealth && !localExecutorHealth.reachable) {
    notes.push(
      `NUC executor geconfigureerd maar niet bereikbaar: ${localExecutorHealth.error ?? "onbekend"}`
    );
  }

  return NextResponse.json({
    agent: {
      computer_use_url_configured: computerUseUrl,
      agent_dedicated_webhook_configured: agentDedicatedWebhookConfigured,
      agent_mode_routes_to_dedicated_webhook: agentDedicatedWebhookConfigured,
      agent_mode_uses_agent_channel: agentModeUsesAgentChannel,
      explicit_agent_webhook_configured: explicitAgent,
      viewer_url_configured: viewerUrl,
      screenshot_url_configured: screenshotUrl,
      browserbase_configured: Boolean(
        process.env.BROWSERBASE_API_KEY?.trim()
      ),
      agent_stream_ingest_configured: streamIngest,
      local_executor_configured: localExecutorConfigured,
      local_executor_reachable: localExecutorHealth?.reachable ?? false,
      local_executor_workspace_exists:
        localExecutorHealth?.health?.workspace_exists ?? false,
      pc_bridge_phase: 2,
      sample_webhook_pathname: (() => {
        try {
          return new URL(sampleAgentWebhook).pathname;
        } catch {
          return null;
        }
      })(),
    },
    memory: {
      qdrant_url_configured: Boolean(process.env.QDRANT_URL?.trim()),
      ollama_url_configured: Boolean(process.env.OLLAMA_URL?.trim()),
      anthropic_api_key_configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      motor_memory_collection:
        process.env.QDRANT_MEMORY_COLLECTION?.trim() || "motor_memory",
      chat_memory_active: Boolean(
        process.env.QDRANT_URL?.trim() ||
          process.env.OLLAMA_URL?.trim() ||
          process.env.ANTHROPIC_API_KEY?.trim()
      ),
    },
    flags: {
      agent_mode_question_uses_factory_webhook: agentRoutesViaFactoryOs,
    },
    dify_builder_configured: assertDifyConfigured(),
    deploy_configured: Boolean(gh && vz),
    missing_recommended: missingRecommended,
    notes,
  });
}
