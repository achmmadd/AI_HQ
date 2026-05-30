import type { ConnectorId } from "@/lib/connectors/registry";

const ORDERS_RE =
  /\b(order|orders|bestelling|bestellingen|omzet|klant|verzending|shopify|woocommerce|vandaag\s+binnen)\b/i;
const BIBLIOTHEEK_RE =
  /\b(bibliotheek|content|post|posts|instagram|blog|seo|draft|concept|planning|social|caption|producttekst|productfoto)\b/i;
const BRIEFING_RE =
  /\b(briefing|overzicht|vandaag|status|actie|kansen|speelt\s+er|prioriteit)\b/i;
const AUTOMATIONS_RE =
  /\b(automation|automations|taak|taken|cron|schedule|gepland|flow|flows|n8n|trigger)\b/i;
const RESEARCH_RE =
  /\b(zoek\s+op|onderzoek|web|internet|actueel|nieuws|bron|bronnen|google)\b/i;
const BUILD_RE =
  /\b(bouw|maak|widget|tool|rekenmachine|calculator|design|layout|styling|css|ui|sjabloon|template|embed)\b/i;
const UX_RE =
  /\b(ux|toegankelijk|accessibility|contrast|check|review|test|wcag|mobiel|focus)\b/i;
const TEMPLATES_RE =
  /\b(sjabloon|template|chat\s*widget|rekenmachine|keuzehulp|quiz|chatbot)\b/i;

export function connectorRelevantForPrompt(
  id: ConnectorId,
  prompt: string,
  opts?: { buildIntent?: boolean }
): boolean {
  const t = prompt.trim();
  if (!t) return false;

  switch (id) {
    case "fumero_orders":
      return ORDERS_RE.test(t);
    case "fumero_bibliotheek":
      return BIBLIOTHEEK_RE.test(t);
    case "fumero_briefing":
      return BRIEFING_RE.test(t);
    case "fumero_automations":
      return AUTOMATIONS_RE.test(t);
    case "online_research":
      return RESEARCH_RE.test(t);
    case "designer":
      return opts?.buildIntent === true || BUILD_RE.test(t);
    case "ux_review":
      return UX_RE.test(t);
    case "templates":
      return opts?.buildIntent === true || TEMPLATES_RE.test(t) || BUILD_RE.test(t);
    default:
      return false;
  }
}

/** Connectors die context mogen injecteren voor deze prompt. */
export function connectorsToFetch(
  enabled: ConnectorId[],
  prompt: string,
  opts?: { onlineMode?: boolean; buildIntent?: boolean }
): ConnectorId[] {
  const out: ConnectorId[] = [];
  for (const id of enabled) {
    if (id === "online_research") {
      if (opts?.onlineMode || connectorRelevantForPrompt(id, prompt, opts)) {
        out.push(id);
      }
      continue;
    }
    if (connectorRelevantForPrompt(id, prompt, opts)) {
      out.push(id);
    }
  }
  return out;
}
