import { getChatLearnedInstructionSuffix } from "@/lib/chat-learned";
import { getMotorDisciplineSuffix } from "@/lib/motor-discipline";
import {
  experimentInstructionOverlay,
  getActiveExperimentForKlant,
  pickVariant,
  type ExperimentVariant,
} from "@/lib/experiments";
import { buildChatSystemPreamble } from "@/lib/chat-prompt";
import { getChatTranscriptForMemory } from "@/lib/chat-memory-transcript";
import {
  normalizeContext,
  type ChatContextMsg,
} from "@/lib/chat-n8n";
import {
  detectChatIntent,
  type ChatIntent,
} from "@/lib/intent-detection";
import { ingestConversationToMotorMemory } from "@/lib/motor-memory";

const BROWSER_TASK_RE =
  /\b(open website|bezoek |ga naar |browse|browser|screenshot|navigeer|klik op|vul in op|inloggen op|zoek op google)\b/i;

/** Alleen echte browser-taken naar agent/run; chat blijft op Factory-tak (snel). */
export function shouldUseBrowserTaskForAgent(
  prompt: string,
  intent: ChatIntent
): boolean {
  if (intent === "action") return true;
  return BROWSER_TASK_RE.test(prompt.trim());
}

export async function buildPromptForN8n(
  klant: string,
  userPrompt: string
): Promise<{
  promptForFactory: string;
  experimentId: number | null;
  experimentVariant: ExperimentVariant | null;
  experimentName: string | null;
}> {
  const exp = getActiveExperimentForKlant(klant);
  const expVariant = exp ? pickVariant() : null;
  const experimentOverlay =
    exp && expVariant ? experimentInstructionOverlay(exp, expVariant) : "";

  const preamble = await buildChatSystemPreamble(klant, userPrompt.trim());
  const promptForFactory =
    preamble +
    `\n\n${getMotorDisciplineSuffix()}\n` +
    getChatLearnedInstructionSuffix() +
    experimentOverlay +
    userPrompt.trim();

  return {
    promptForFactory,
    experimentId: exp?.id ?? null,
    experimentVariant: expVariant,
    experimentName: exp?.name ?? null,
  };
}

/** Korte-termijn: DB-transcript + client-context (laatste 24 berichten). */
export function mergeConversationContext(
  conversationId: number | null,
  clientContext: ChatContextMsg[]
): ChatContextMsg[] {
  const fromClient = normalizeContext(clientContext);
  if (!conversationId) return fromClient;

  const fromDb = getChatTranscriptForMemory(conversationId, 24);
  if (!fromDb.length) return fromClient;
  if (!fromClient.length) return normalizeContext(fromDb);

  const seen = new Set<string>();
  const merged: ChatContextMsg[] = [];
  for (const m of [...fromDb, ...fromClient]) {
    const key = `${m.role}\0${m.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
  }
  return normalizeContext(merged);
}

const MEMORY_INGEST_MIN_MESSAGES = 4;

/** Langetermijn: na voldoende berichten, achtergrond-samenvatting naar Qdrant. */
export function maybeIngestMotorMemory(
  conversationId: number | null,
  klant: string
): void {
  if (!conversationId) return;
  const transcript = getChatTranscriptForMemory(conversationId, 48);
  if (transcript.length < MEMORY_INGEST_MIN_MESSAGES) return;

  const assistantTurns = transcript.filter((t) => t.role === "assistant").length;
  if (assistantTurns < 2 || assistantTurns % 3 !== 0) return;

  void ingestConversationToMotorMemory(transcript, klant, conversationId);
}

/** `prompt` is canonical; `message` / `text` / `q` accepted for curl and external clients. */
export function parseChatUserPrompt(body: Record<string, unknown>): string {
  for (const key of ["prompt", "message", "text", "q"] as const) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export { detectChatIntent };
export { shouldUseLocalExecutor } from "@/lib/local-action";
