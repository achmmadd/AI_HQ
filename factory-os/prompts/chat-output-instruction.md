# Chat output (Dify / Factory OS)

Voor **chat** met eindgebruikers: het antwoord moet **alleen de nuttige tekst** zijn.

- Geen regels als `Klant: … · Agent: … · Datum: …`
- Geen markdown-secties `## Samenvatting` of `## Volledige response`
- Geen afsluitregel met `Factory OS · Dify all-in-one`

**Engels kort:** OUTPUT ONLY THE DIRECT ANSWER. NO metadata blocks.

De ai-motor voegt bij chat-requests een korte instructie voor dezelfde regel toe; n8n kan dit desgewenst in het Dify **system prompt** van de agent herhalen.
