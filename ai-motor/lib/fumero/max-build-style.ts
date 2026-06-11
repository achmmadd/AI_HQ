/**
 * Smokey (Fumero) — regels voor widgets, games en embeddable HTML.
 * Gebruikt in tools-service, design-builder en chat-stijl.
 * Referentie-implementaties: flappy-fumero, fumero-chatbot, champions-league.
 */

/** Compacte feiten uit kennisbank — bron van waarheid voor klantcopy. */
export const FUMERO_KENNISBANK_FACTS = [
  "Levertijd: werkdagen vóór 17:00 → volgende werkdag verzonden; gem. 1 werkdag NL; track & trace.",
  "Retour: 14 dagen, ongeopend; geopende vapes/edibles uitgesloten; info@fumero.nl.",
  "HHC: semi-synthetisch cannabinoïde, milder dan THC; uitsluitend 18 jaar en ouder.",
  "Betaling: bankoverschrijving + crypto (DePay) — NIET iDEAL, creditcard of PayPal.",
  "Minimum order: €49.",
  "Contact: info@fumero.nl; reactie doorgaans binnen één werkdag.",
].join("\n");

/** Korte hint-string voor LLM build-prompts (tools-service, artifact-generate). */
export const FUMERO_BUILD_HINTS =
  "VERPLICHT: één compleet zelfstandig HTML5-document (<!DOCTYPE html>, volledige <head> en <body>, inline CSS, één <script> zonder type=module). " +
  "Lever ALTIJD volledige code — nooit afkappen midden in een functie, tag of string; sluit elke haak, tag, </script>, </body> en </html> af. " +
  "Vermenigvuldiging vereist altijd de *-operator (Math.random()*W, Math.PI*2, Math.cos(a)*speed) — nooit spaties zonder operator. " +
  "CSS reset: *, ::before, ::after { box-sizing: border-box; } — nooit ', ::before' zonder *. " +
  "Controleer vóór je antwoord: alle functies gesloten, game-loop + addEventListener aanwezig bij games. " +
  "Gebruik kennisbank-feiten voor product-/beleidscopy; verzin geen betaalmethoden of levertijden. " +
  "Brand voice: professioneel, rustig, premium; je/jij; geen emoji in UI; 18+ als '18 jaar en ouder'. " +
  "Gebruikersinvoer in widgets ALTIJD via textContent (nooit innerHTML met user input). " +
  "Preview: vermeld http://127.0.0.1:8765/... (start-fumero-preview.sh), nooit file://-paden.";

export function formatMaxBuildStyleBlock(): string {
  return [
    "### Smokey — bouwen (widgets, games, chatbots)",
    "Referentiekwaliteit: zelfde niveau als flappy-fumero en fumero-chatbot — één bestand, direct werkend in iframe.",
    "",
    "**Volledige code:**",
    "- Altijd één compleet HTML-document; nooit afkappen, geen '... rest van code' of halve functies.",
    "- Sluit </script>, </body>, </html> af. Bij games: volledige game-loop, start-scherm, score.",
    "- Vermenigvuldiging altijd met * (Math.random()*W, Math.PI*2) — nooit spaties zonder operator.",
    "- CSS reset: *, ::before, ::after — nooit ', ::before' zonder universele *.",
    "- Geen React, geen ES-modules, geen externe frameworks — vanilla JS met addEventListener.",
    "",
    "**Brand voice (klantcopy):**",
    "- Professioneel, rustig, premium, discreet; je/jij; geen emoji in UI-chrome.",
    "- 18+ altijd als '18 jaar en ouder' of 'uitsluitend 18 jaar en ouder'.",
    "- Geen dev-jargon in klanttekst (geen 'deploy', 'XSS-safe', etc.).",
    "",
    "**Feiten (kennisbank = bron van waarheid):**",
    FUMERO_KENNISBANK_FACTS,
    "- Bij twijfel: gebruik LIVE PAGINA-blok of kennisbank-treffers; verzin geen prijzen of betaalmethoden.",
    "",
    "**Veiligheid:**",
    "- Dynamische tekst (chatberichten, FAQ-antwoorden, gebruikersinvoer) via element.textContent, niet innerHTML.",
    "",
    "**Preview lokaal:**",
    "- Start: ./start-fumero-preview.sh (poort 8765).",
    "- Open bv. http://127.0.0.1:8765/fumero-chatbot/index.html — nooit file://-URLs naar de gebruiker.",
    "",
    "**Visueel:**",
    "- Merkkleur #69C400 spaarzaam; wit/#FAFAFA; Geist of system-ui; mobielvriendelijk; min. 44px touch targets.",
    "",
    "**Biz-artefacten (chatbot, landingspagina, formulier, dashboard):**",
    "- Leid de bedoeling af uit informele prompts — geen prompt-coaching.",
    "- Landingspagina: hero + voordelen + CTA + footer in één scrollbare pagina.",
    "- Formulier: labels, validatie, verzendknop, bedank-state — geen backend nodig.",
    "- Dashboard: KPI-tegels + tabel met voorbeelddata; houd het compact (geen volledig CRM).",
    "- Chatbot: FAQ-suggesties, korte antwoorden, professionele toon.",
  ].join("\n");
}
