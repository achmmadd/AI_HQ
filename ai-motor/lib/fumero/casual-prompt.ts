/**
 * Informele gebruikersprompts (Bouwen / Max) — geen perfecte "prompt engineering" nodig.
 */

const CASUAL_BUILD_RE = [
  /\b(wil|wilde)\s+(een\s+)?(iets|wat|tool|widget|bot|chat|hulp)\b/i,
  /\b(kan|kun|zou)\s+(je|u)\s+.+\s+(maken|bouwen|zetten|toevoegen|fixen)\b/i,
  /\b(help|help me)\s+(met\s+)?(een\s+)?(tool|widget|chat|bot|iets)\b/i,
  /\b(iets|wat)\s+(voor|op)\s+(de\s+)?(site|website|shop|webshop)\b/i,
  /\b(klanten|bezoekers|mensen).{0,40}(vragen|hulp|chat|antwoord)/i,
  /\b(vragen|faq|klantenservice|support).{0,40}(site|website|widget|bot|chat)/i,
  /\b(kennisbank|info).{0,40}(site|bot|chat|widget|klanten)/i,
  /\b(zet|zetten|plaats|plaatsen).{0,20}(op|aan)\s+(de\s+)?(site|website|shop)\b/i,
  /\b(laat|laten)\s+(klanten|bezoekers)\b/i,
  /\bbouw\s+(iets|wat|een)\b/i,
  /\bmaak\s+(iets|wat|een)\b/i,
  /\b(voor|op)\s+(de\s+)?(site|website|webshop)\b/i,
];

const CASUAL_SCRAPE_RE =
  /\b(pak|haal|lees|gebruik|neem|check|bekijk).{0,30}(info|informatie|tekst|content|alles|site|website)\b/i;

const BROAD_SITE_CHECK_RE =
  /\b(check|bekijk|doorloop|scan).{0,25}(hele|volledige|complete).{0,20}(site|website|webshop)\b/i;

/** Informele site-check (NL chat: "ff", "even"). */
const CASUAL_SITE_CHECK_FF_RE = [
  /^check\s+ff\.?$/i,
  /^ff\s+check\.?$/i,
  /^kijk\s+ff\.?$/i,
  /^check\s+even\b/i,
  /^even\s+checken\b/i,
  /^site\s+ff\.?$/i,
  /\bcheck\s+ff\b/i,
  /\bff\s+check\b/i,
  /\bkijk\s+ff\b/i,
  /\bsite\s+ff\b/i,
  /\beven\s+checken\b/i,
];

const SITE_MENTION_RE =
  /\b(fumero\.nl|fumero|onze\s+(?:site|website|shop|webshop)|de\s+(?:site|website|webshop))\b/i;

const PURE_QUESTION_START_RE =
  /^(wat|hoe|waarom|wanneer|wie|welke|is|zijn|heeft|hebben|vertel|uitleg)\b/i;

/** Losse bouw-wens zonder perfecte keywords (bv. "iets op de site voor klantvragen"). */
export function looksLikeCasualBuildRequest(prompt: string): boolean {
  const t = prompt.trim();
  if (t.length < 8) return false;
  if (PURE_QUESTION_START_RE.test(t.toLowerCase()) && t.endsWith("?")) {
    return false;
  }
  return CASUAL_BUILD_RE.some((re) => re.test(t));
}

/** "check ff", "kijk ff", korte site-check in Bouwen/Max. */
export function looksLikeCasualSiteCheckFfRequest(prompt: string): boolean {
  const t = prompt.trim();
  if (!t || t.length > 80) return false;
  if (CASUAL_SITE_CHECK_FF_RE.some((re) => re.test(t))) return true;
  if (/\bcheck\b/i.test(t) && /\bff\b/i.test(t)) return true;
  return false;
}

/** Site-check of live pagina in chat (geen tool-build). */
export function isFumeroSiteCheckChatIntent(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  return (
    looksLikeBroadSiteCheckRequest(t) ||
    looksLikeCasualSiteCheckFfRequest(t) ||
    looksLikeCasualScrapeRequest(t)
  );
}

/** "check hele site", "site check", etc. */
export function looksLikeBroadSiteCheckRequest(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (BROAD_SITE_CHECK_RE.test(t)) return true;
  if (/\bsite\s*check\b/i.test(t) && SITE_MENTION_RE.test(t)) return true;
  if (/\bcheck\s+(?:even\s+)?(?:de\s+)?site\b/i.test(t) && SITE_MENTION_RE.test(t)) {
    return true;
  }
  return false;
}

/** Site-info ophalen in gewone taal (zonder "scrape"). */
export function looksLikeCasualScrapeRequest(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (looksLikeBroadSiteCheckRequest(t)) return true;
  if (looksLikeCasualSiteCheckFfRequest(t)) return true;
  if (/^(zie|kijk|bekijk)\s+https?:\/\//i.test(t) && !CASUAL_SCRAPE_RE.test(t)) {
    return false;
  }
  if (CASUAL_SCRAPE_RE.test(t) && SITE_MENTION_RE.test(t)) return true;
  if (
    SITE_MENTION_RE.test(t) &&
    /\b(haal|pak|lees|gebruik|ophalen|scrape|scrapen)\b/i.test(t) &&
    /\b(bot|chat|widget|kennisbank|faq|vragen|klanten|info|site|website)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** Voor tool-build: korte context dat de zin informeel is. */
export function enrichCasualBouwenPrompt(prompt: string): string {
  const t = prompt.trim();
  if (!t || !looksLikeCasualBuildRequest(t)) return t;
  if (
    /\b(maak|bouw|widget|tool|chatbot|rekenmachine|template|sjabloon)\b/i.test(t)
  ) {
    return t;
  }
  return [
    "Gebruikerswens (informeel — leid de bedoeling af, vraag niet om een 'betere prompt'):",
    t,
  ].join("\n");
}

export function formatMaxCasualUserLanguageBlock(): string {
  return [
    "### Informele prompts (belangrijk)",
    "De gebruiker typt zoals in WhatsApp — korte zinnen, geen technische formules, geen scrape_url-syntax.",
    "Leid intent af: vraag beantwoorden, iets bouwen, site-info gebruiken, of verfijnen.",
    "Ontbrekende cruciale info (welke pagina, voor wie, wat het moet doen): stel eerst 1–3 korte vragen — nog niet bouwen of scrape forceren.",
    "Geen prompt-coaching. Bevestig kort wat je gaat doen zodra het helder is.",
    "Bij 'check hele site' / site-check: meerdere pagina's worden al opgehaald — geef daarna een korte samenvatting (3–6 bullets), geen auditlijst.",
  ].join("\n");
}
