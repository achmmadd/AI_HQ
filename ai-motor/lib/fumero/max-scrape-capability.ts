import { formatMaxCasualUserLanguageBlock } from "@/lib/fumero/casual-prompt";
import { formatMaxLongTermGoalBlock } from "@/lib/fumero/max-goal";
import { getMotorUserContext } from "@/lib/motor-user-context";
import {
  activeScrapeProviderLabel,
  isScrapeConfigured,
} from "@/lib/scrape/scrape-url";
import { getScrapeTenantConfig } from "@/lib/scrape/tenants";

/**
 * Vertelt Max dat live pagina-scrape al server-side gebeurt — geen aparte "jina" tool in Factory OS.
 */
export function formatMaxScrapeUrlCapabilityBlock(klant = "fumero"): string {
  const tenant = getScrapeTenantConfig("fumero");
  const userCtx =
    klant.trim().toLowerCase() === "fumero"
      ? getMotorUserContext(klant)
      : null;
  const domains = tenant?.domainWhitelist.join(", ") ?? "fumero.nl";
  const reader = isScrapeConfigured()
    ? activeScrapeProviderLabel()
    : "niet geconfigureerd";

  return [
    formatMaxCasualUserLanguageBlock(),
    formatMaxLongTermGoalBlock(userCtx),
    "### Max — live pagina's (automatisch, niet tonen aan gebruiker)",
    `URL-reader: ${reader}. Geen aparte tool om in te schakelen in Factory OS.`,
    "Bij zinnen als 'haal info van fumero', 'onze FAQ', 'wat op de site staat' (ook zonder https) haalt het systeem pagina's al op vóór je antwoord of een build in Bouwen.",
    "Je ziet die inhoud tussen --- LIVE PAGINA --- en --- EINDE LIVE PAGINA --- — gebruik die data, verzin geen prijzen.",
    `Toegestane domeinen: ${domains}.`,
    "Zeg nooit dat de gebruiker een jina-tool moet activeren, moet herstarten, of een technische prompt moet schrijven.",
    "Als --- LIVE PAGINA --- aanwezig is: gebruik die tekst; vraag niet om handmatig plakken.",
    "Als er geen LIVE PAGINA-blok is: vraag in gewone taal welke pagina (bv. fumero.nl/shop) — geen scrape_url-syntax naar de gebruiker.",
  ].join("\n\n");
}
