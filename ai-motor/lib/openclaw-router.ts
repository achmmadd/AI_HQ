import { buildChatSystemPreamble } from "@/lib/chat-prompt";
import { getChatLearnedInstructionSuffix } from "@/lib/chat-learned";
import { getMotorDisciplineSuffix } from "@/lib/motor-discipline";
import type { ChatContextMsg } from "@/lib/chat-n8n";
import { detectChatIntent, type ChatIntent } from "@/lib/intent-detection";
import {
  resolveMotorsChatAction,
  type MotorsChatAction,
} from "@/lib/motors-orchestrator";
import type { OpenClawChatMessage } from "@/lib/openclaw-gateway";

export type OpenClawChatRequest = {
  prompt: string;
  klant: string;
  conversationId: number | null;
  context: ChatContextMsg[];
  agentMode: boolean;
  planMode?: boolean;
  hasActiveProject?: boolean;
  activeProjectId?: number;
  /** Lichte preamble (geen Qdrant/kennisbank prefetch). */
  fastPreamble?: boolean;
};

export type OpenClawRoutingMeta = {
  intent: ChatIntent;
  suggested_action: MotorsChatAction["type"];
  agent_mode: boolean;
  workspace: string;
};

export function resolveOpenClawWorkspace(klant: string): string {
  const k = klant.trim().toLowerCase();
  if (k === "fumero" || k === "bokas") return `factory-os-${k}`;
  return "factory-os";
}

export function resolveSuggestedAction(
  prompt: string,
  hasActiveProject?: boolean
): MotorsChatAction["type"] {
  return resolveMotorsChatAction({
    prompt,
    hasActiveProject: Boolean(hasActiveProject),
  }).type;
}

export async function buildOpenClawMessages(
  req: OpenClawChatRequest
): Promise<{ messages: OpenClawChatMessage[]; meta: OpenClawRoutingMeta }> {
  const intent = detectChatIntent(req.prompt);
  const suggested_action = resolveSuggestedAction(
    req.prompt,
    req.hasActiveProject
  );
  const workspace = resolveOpenClawWorkspace(req.klant);

  const preamble = await buildChatSystemPreamble(req.klant, req.prompt, {
    activeProjectId: req.activeProjectId,
    conversationId: req.conversationId,
    fast: req.fastPreamble,
  });

  const planHint = req.planMode
    ? "\n[PLAN-MODUS] Geef eerst een kort stappenplan (genummerd). Voer nog GEEN bestanden of commando's uit tenzij de gebruiker vraagt om uit te voeren of 'ga door'."
    : "";

  const systemParts = [
    preamble,
    `\n${getMotorDisciplineSuffix()}`,
    getChatLearnedInstructionSuffix(),
    planHint,
    `\n[MotorsAI] intent=${intent}; action=${suggested_action}; klant=${workspace}; agent=${req.agentMode}; plan=${Boolean(req.planMode)}; conv=${req.conversationId ?? "none"}.`,
  ];

  const messages: OpenClawChatMessage[] = [
    { role: "system", content: systemParts.join("\n") },
  ];

  for (const m of req.context.slice(-20)) {
    const role = m.role === "assistant" ? "assistant" : "user";
    if (m.content?.trim()) {
      messages.push({ role, content: m.content.trim() });
    }
  }

  messages.push({ role: "user", content: req.prompt.trim() });

  return {
    messages,
    meta: {
      intent,
      suggested_action,
      agent_mode: req.agentMode,
      workspace,
    },
  };
}

export function openClawUserKey(
  klant: string,
  conversationId: number | null
): string {
  return conversationId
    ? `motorsai:${klant}:conv:${conversationId}`
    : `motorsai:${klant}:anon`;
}
