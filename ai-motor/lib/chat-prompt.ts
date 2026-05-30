import { CHAT_OUTPUT_INSTRUCTION_PREFIX } from "@/lib/chat-n8n";
import {
  useRichChatContext,
  useRichChatContextForKlant,
} from "@/lib/chat-routing-policy";
import { searchMotorMemories } from "@/lib/motor-memory";
import {
  payloadTextWithProvenance,
  searchKnowledge,
} from "@/lib/knowledge-service";
import { buildResumeContextBlock } from "@/lib/resume-preamble";
import { getLatestFumeroBriefing } from "@/lib/fumero/briefing";
import { formatMaxBriefingSystemBlock } from "@/lib/fumero/max-briefing-chat";

function klantDisplayName(klant: string): string {
  const byId: Record<string, string> = {
    fumero: "Fumero",
    bokas: "Bokas",
    system: "Systeem",
  };
  const k = klant.trim().toLowerCase();
  if (byId[k]) return byId[k];
  if (!k) return "Klant";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

function buildChatInstructionPrefix(opts: {
  klantDisplay: string;
  personaLine: string;
  memoriesBlock: string;
  knowledgeBlock: string;
  resumeBlock: string;
  maxBriefingBlock?: string;
}): string {
  const maxBlock = opts.maxBriefingBlock
    ? `\n\n${opts.maxBriefingBlock}\n`
    : "";
  return (
    CHAT_OUTPUT_INSTRUCTION_PREFIX +
    `${opts.personaLine} Werk conversationeel en concreet (zoals een sterke Claude-chat): heldere stappen bij complexe taken, maximaal één verduidelijkende vraag als iets ontbreekt, bullet lists voor actiepunten. Antwoord in het Nederlands, tenzij de gebruiker expliciet een andere taal vraagt. Bij live webonderzoek: vermeld bronnen met URL. Gebruik onderstaand geheugen en kennis waar relevant; verzin geen feiten die daar niet in staan. Bij twijfel tussen bronnen: geef voorkeur aan de snippet met nieuwere indexdatum of expliciete bron-URI.\n\n` +
    `${opts.resumeBlock}\n\n` +
    `### Qdrant-geheugen\n${opts.memoriesBlock}\n\n` +
    `### Kennisbank\n${opts.knowledgeBlock}${maxBlock}`
  );
}

function personaForKlant(klant: string, klantDisplay: string): string {
  if (klant.trim().toLowerCase() === "fumero") {
    return "Je bent Max, proactieve AI-collega voor Fumero (fumero.nl) — geen passieve chatbot. Je werkt mee alsof je op de achtergrond al briefings en studio's hebt gecheckt.";
  }
  return `Je bent MotorsAI, de primaire AI-assistent voor ${klantDisplay}.`;
}

function maxBriefingBlockForKlant(klant: string): string | undefined {
  if (klant.trim().toLowerCase() !== "fumero") return undefined;
  const b = getLatestFumeroBriefing();
  if (!b) return undefined;
  return formatMaxBriefingSystemBlock(b);
}

/**
 * Systeemprompt-deel voor elke chat: persona, Qdrant-geheugen (top 5), kennisbank (top 3).
 */
function openClawFastPreambleEnabled(): boolean {
  if (process.env.OPENCLAW_FAST_PREAMBLE?.trim() === "0") return false;
  if (process.env.OPENCLAW_FAST_PREAMBLE?.trim() === "1") return true;
  return !useRichChatContext();
}

export async function buildChatSystemPreamble(
  klant: string,
  userPrompt: string,
  opts?: {
    activeProjectId?: number;
    fast?: boolean;
    conversationId?: number | null;
  }
): Promise<string> {
  const q = userPrompt.trim();
  const richContext = useRichChatContextForKlant(klant);
  const rich =
    richContext &&
    (opts?.conversationId != null || process.env.OPENCLAW_FAST_PREAMBLE?.trim() === "0");
  const fast = opts?.fast ?? (openClawFastPreambleEnabled() && !rich);

  if (fast) {
    const resumeBlock = await buildResumeContextBlock(klant, {
      userPrompt: q,
      activeProjectId: opts?.activeProjectId,
    });
    return buildChatInstructionPrefix({
      klantDisplay: klantDisplayName(klant),
      personaLine: personaForKlant(klant, klantDisplayName(klant)),
      memoriesBlock: "(OpenClaw: geheugen via gateway-tools)",
      knowledgeBlock: "(OpenClaw: kennis via gateway)",
      resumeBlock,
      maxBriefingBlock: maxBriefingBlockForKlant(klant),
    });
  }

  const [memRes, knowRes, resumeBlock] = await Promise.all([
    searchMotorMemories(q, klant, 5),
    searchKnowledge(q, { klant, limit: 3 }),
    buildResumeContextBlock(klant, {
      userPrompt: q,
      activeProjectId: opts?.activeProjectId,
    }),
  ]);

  const memoriesBlock =
    memRes.results.length > 0
      ? memRes.results
          .map((h, i) => `${i + 1}. ${payloadTextWithProvenance(h)}`)
          .join("\n")
      : "(geen eerdere herinneringen)";

  const knowledgeBlock =
    knowRes.results.length > 0
      ? knowRes.results
          .map((h, i) => `${i + 1}. ${payloadTextWithProvenance(h)}`)
          .join("\n")
      : "(geen treffers in kennisbank)";

  return buildChatInstructionPrefix({
    klantDisplay: klantDisplayName(klant),
    personaLine: personaForKlant(klant, klantDisplayName(klant)),
    memoriesBlock,
    knowledgeBlock,
    resumeBlock,
    maxBriefingBlock: maxBriefingBlockForKlant(klant),
  });
}
