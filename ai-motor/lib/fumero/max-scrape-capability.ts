import {
  activeScrapeProviderLabel,
  isScrapeConfigured,
} from "@/lib/scrape/scrape-url";
import { getScrapeTenantConfig } from "@/lib/scrape/tenants";

/**
 * Vertelt Max dat live pagina-scrape al server-side gebeurt — geen aparte "jina" tool in Factory OS.
 */
export function formatMaxScrapeUrlCapabilityBlock(): string {
  const tenant = getScrapeTenantConfig("fumero");
  const domains = tenant?.domainWhitelist.join(", ") ?? "fumero.nl";
  const reader = isScrapeConfigured()
    ? activeScrapeProviderLabel()
    : "niet geconfigureerd";

  return [
    "### Max — live pagina's (scrape_url, al actief)",
    `URL-reader: ${reader}. Geen aparte tool om in te schakelen in Factory OS.`,
    "Wanneer de gebruiker scrape/haal info vraagt of fumero.nl noemt (ook zonder https), haalt het systeem pagina's al op vóór je antwoord of vóór een tool-build in Bouwen.",
    "Je ziet die inhoud in een blok LIVE PAGINA in de context — gebruik die data, verzin geen prijzen.",
    `Toegestane domeinen: ${domains}.`,
    "Zeg nooit dat de gebruiker een jina-tool moet activeren of de chat moet herstarten voor scrape — dat klopt niet.",
    "Als er geen LIVE PAGINA-blok is: vraag om een volledige https-link of formuleer: scrape_url: https://…",
  ].join("\n");
}
