import { isCampaignTemplateOnly } from "@/lib/photo-studio/campaign/llm";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";

export type CampaignStudioConfig = {
  fal_configured: boolean;
  openrouter_configured: boolean;
  /** Strategy/copy use templates only (no OpenRouter/n8n). */
  template_only: boolean;
  /** When true, generate skips fal static/video (explicit or auto when FAL missing). */
  default_skip_media: boolean;
  media_available: boolean;
  hints: string[];
};

function falConfigured(): boolean {
  return Boolean(
    process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim()
  );
}

export function getCampaignStudioConfig(): CampaignStudioConfig {
  const fal = falConfigured();
  const openrouter = isOpenRouterDirectConfigured();
  const templateOnly = isCampaignTemplateOnly();
  const hints: string[] = [];

  if (!fal) {
    hints.push(
      "FAL_KEY of FAL_API_KEY ontbreekt — static creatives en Reels worden overgeslagen. Gebruik “Alleen strategy + copy” of stel FAL_KEY in op de server."
    );
  }
  if (templateOnly) {
    hints.push(
      "Template-modus actief — strategie en copy gebruiken vaste templates (CAMPAIGN_TEMPLATE_ONLY=1). Media blijft beschikbaar als FAL_KEY aanwezig is."
    );
  } else if (!openrouter) {
    hints.push(
      "OPENROUTER_API_KEY ontbreekt — strategie en copy proberen n8n, anders templates na timeout (max ~30s)."
    );
  }

  return {
    fal_configured: fal,
    openrouter_configured: openrouter,
    template_only: templateOnly,
    default_skip_media: !fal,
    media_available: fal,
    hints,
  };
}

export function resolveCampaignSkipMedia(
  skipMediaFlag: boolean | undefined
): { skipMedia: boolean; autoSkipped: boolean } {
  const fal = falConfigured();

  if (skipMediaFlag === true) {
    return { skipMedia: true, autoSkipped: false };
  }
  if (skipMediaFlag === false && fal) {
    return { skipMedia: false, autoSkipped: false };
  }
  if (!fal) {
    return { skipMedia: true, autoSkipped: true };
  }
  return { skipMedia: false, autoSkipped: false };
}
