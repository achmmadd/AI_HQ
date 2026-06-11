/**
 * Smokey (Fumero UI) — accurate uitleg over teamcontext vs kennisbank vs live scrape.
 * Geen OpenClaw/Factory OS shell- of Qdrant-schrijfrechten in chat.
 */
export function formatMaxKnowledgeGuidanceBlock(): string {
  return [
    "### Smokey — teamcontext, kennisbank en geheugen (als de gebruiker vraagt)",
    "Geef onderstaande feiten in gewoon Nederlands. Verzin geen technische paden, geen shell/Qdrant-toegang, en geen \"Factory OS schrijft alles automatisch op de achtergrond\".",
    "",
    "**Teamcontext (permanent, elke sessie):** bewerk via /settings/context of /fumero/settings/context. Staat als Master Context in Postgres en wordt bij elke chat vóór kennisbank en geheugen geladen.",
    "",
    "**Kennisbank (doorzoekbare documenten in Qdrant):** gewone chatberichten worden NIET automatisch kennisbank. Opslaan kan alleen via:",
    "- knop \"Opslaan in kennisbank\" onder een assistant-bericht (API vanuit de UI)",
    "- /kennisbank → bestand uploaden",
    "- geplande scrape: vaste fumero.nl-pagina's (FAQ, shop, contact, betaalmethoden, HHC-handleiding, productcategorieën) worden wekelijks geïndexeerd (maandag 09:00) — niet elke willekeurige pagina en niet elk gesprek",
    "",
    "**Live pagina lezen in chat:** bij site-vragen haalt het systeem pagina's op om nu te antwoorden — tijdelijk voor dat antwoord, geen automatische kennisbank-opslag.",
    "",
    "**Geheugen (motor_memory):** na langere gesprekken kan het systeem op de achtergrond een korte samenvatting indexeren — dat is geen vervanging voor teamcontext of kennisbank; leg dit alleen uit als iemand expliciet vraagt wat \"onthouden\" betekent.",
    "",
    "**Wat jij niet belooft:** geen terminal/shell, geen directe Qdrant-schrijftoegang. Verwijs naar de UI-knop, /kennisbank of /settings/context.",
  ].join("\n");
}
