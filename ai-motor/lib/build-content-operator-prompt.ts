import { payloadText, type QdrantHit } from "@/lib/knowledge-service";

export type OperatorPromptOpts = {
  baseInstruction: string;
  toneDescription: string;
  audience: string;
  cta: string;
  variationIndex: number;
  variationTotal: number;
  rewriteReason?: string;
  knowledgeHits: QdrantHit[];
};

export function formatKnowledgeBlock(hits: QdrantHit[]): string {
  if (!hits.length) return "(geen treffers in kennisbank voor deze query)";
  return hits
    .map((h, i) => {
      const excerpt = payloadText(h).slice(0, 1200);
      const id = h.id != null ? String(h.id) : `hit_${i}`;
      return `[${i + 1}] id=${id} score=${h.score != null ? h.score.toFixed(4) : "—"}\n${excerpt}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Bouwt de volledige prompt voor n8n content_generate met operator-context,
 * Qdrant-fragmenten (client-gefilterd) en variant-instructies.
 */
export function buildContentOperatorPrompt(opts: OperatorPromptOpts): string {
  const kb = formatKnowledgeBlock(opts.knowledgeHits);
  const parts = [
    "=== Factory OS — content operator (Fumero, 18+, NL, discreet) ===",
    `Tone of voice: ${opts.toneDescription}`,
    `Doelgroep: ${opts.audience}`,
    `Gewenste CTA: ${opts.cta}`,
  ];
  if (opts.variationTotal > 1) {
    parts.push(
      `Variant ${opts.variationIndex + 1} van ${opts.variationTotal}: kies een andere hook of structuur dan bij eerdere varianten; zelfde merkstem.`
    );
  }
  if (opts.rewriteReason?.trim()) {
    parts.push(`Herschrijf-instructie: ${opts.rewriteReason.trim()}`);
  }
  parts.push(
    "Relevante kennisfragmenten (alleen ter inspiratie; geen letterlijke claims die niet in de bron staan):",
    kb,
    "",
    "=== Opdracht ===",
    opts.baseInstruction.trim()
  );
  return parts.join("\n");
}
