import {
  anthropicComplete,
  getAnthropicApiKey,
  getAnthropicChatModel,
} from "@/lib/anthropic-messages";
import { logAgentUsage } from "@/lib/agent-usage-log";

export type AnalystScores = {
  brand_guideline_score: number;
  compliance_score: number;
  brand_note: string;
  compliance_note: string;
};

const ANALYST_MODEL =
  process.env.ANALYST_MODEL?.trim() || "claude-haiku-4-5-20251001";

/**
 * Analyst (Haiku): twee zichtbare scores — merkrichtlijnen vs. compliance (18+, claims, tone).
 */
export async function scoreContentForOperator(opts: {
  content: string;
  platform: string;
  klant: string;
  toneDescription: string;
}): Promise<{ scores: AnalystScores | null; skipped: string | null }> {
  if (!getAnthropicApiKey()) {
    return { scores: null, skipped: "ANTHROPIC_API_KEY ontbreekt" };
  }

  const system = `Je bent de Analyst-agent voor Factory OS. Beoordeel GEEN juridische geldigheid; wel risico's op misleiding, gezondheidsclaims, te expliciete claims, of schending van discreet/premium merkstem.
Antwoord ALLEEN met compact JSON, geen markdown:
{"brand_guideline_score":0-100,"compliance_score":0-100,"brand_note":"max 2 zinnen","compliance_note":"max 2 zinnen"}
brand_guideline_score = aansluiting bij tone en merk (Fumero: discreet, premium, 18+).
compliance_score = geen ongeoorloofde gezondheidsclaims, geen beloften over medicinale werking, geen targeting minderjarigen, geen misleidende prijs/actie — hoger is veiliger.`;

  const user = `Klant: ${opts.klant}
Platform: ${opts.platform}
Tone of voice (verwacht): ${opts.toneDescription}

TEKST:
${opts.content.slice(0, 8000)}`;

  const t0 = Date.now();
  try {
    const { text, model, input_tokens, output_tokens } = await anthropicComplete({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 512,
      model: ANALYST_MODEL,
    });

    const raw = text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Geen JSON in Analyst-response");
    }
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const scores: AnalystScores = {
      brand_guideline_score: Math.min(
        100,
        Math.max(0, Number(parsed.brand_guideline_score) || 0)
      ),
      compliance_score: Math.min(
        100,
        Math.max(0, Number(parsed.compliance_score) || 0)
      ),
      brand_note:
        typeof parsed.brand_note === "string" ? parsed.brand_note : "",
      compliance_note:
        typeof parsed.compliance_note === "string"
          ? parsed.compliance_note
          : "",
    };

    logAgentUsage({
      agentLabel: "Analyst",
      klant: opts.klant,
      afdeling: "content_qa",
      model,
      promptTokens: input_tokens,
      completionTokens: output_tokens,
      durationMs: Date.now() - t0,
      success: true,
      inputPreview: user.slice(0, 1200),
      outputPreview: raw,
    });

    return { scores, skipped: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAgentUsage({
      agentLabel: "Analyst",
      klant: opts.klant,
      afdeling: "content_qa",
      model: getAnthropicChatModel(),
      durationMs: Date.now() - t0,
      success: false,
      inputPreview: user.slice(0, 1200),
      outputPreview: msg,
    });
    return { scores: null, skipped: msg };
  }
}
