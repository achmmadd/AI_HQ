# Max build prompt — Champions League kwaliteit

Gebruik dit als **directe instructie aan Max** (Bouwen-tab of chat) wanneer je een widget, game of chatbot wilt die hetzelfde niveau haalt als de referentieprojecten.

## Snelle prompt (kopieer en pas aan)

```
Bouw een [chatbot / game / widget] voor Fumero.

Doel: [kort wat het moet doen, bv. FAQ over verzending en betaling]

VERPLICHT:
- Eén compleet zelfstandig index.html (inline CSS + één <script> zonder type=module)
- Volledige code — nooit afkappen; sluit alle tags en functies af
- Feiten uit Fumero-kennisbank (geen iDEAL — alleen bankoverschrijving + crypto DePay)
- Brand voice: professioneel, rustig, je/jij, geen emoji, 18+ als "18 jaar en ouder"
- Gebruikersinvoer via textContent, niet innerHTML
- Fumero-stijl: #69C400 spaarzaam, wit/#FAFAFA, system-ui/Geist, mobielvriendelijk

Referentie: zelfde kwaliteit als fumero-chatbot of flappy-fumero.

Preview na afloop: start ./start-fumero-preview.sh en open http://127.0.0.1:8765/[map]/index.html
```

## Voorbeelden per type

### FAQ-chatbot

```
Bouw een FAQ-chatbot widget voor fumero.nl.

- Zwevende groene knop rechtsonder, chatpaneel met suggestie-chips
- Antwoorden op: levertijd, retour, HHC, betaling, minimum order €49, contact
- Betaling: bankoverschrijving + crypto (DePay) — expliciet GEEN iDEAL/creditcard/PayPal
- Alle bot-tekst via textContent; professionele NL copy, je/jij
- Eén compleet index.html, direct werkend in iframe
```

### Game (canvas)

```
Bouw een [Flappy-achtig] spel met Fumero-branding.

- <canvas> + requestAnimationFrame, start-overlay met knop, score zichtbaar
- Spatie/tik als input; volledige game-loop in één HTML-bestand
- Donkere achtergrond, accent #69C400, geen modules
- Lever complete code — geen afgekapte functies
```

### Algemene widget

```
Bouw een [keuzehulp / rekenmachine / leeftijdscheck] voor Fumero.

- Max breedte ~480px, embeddable, vanilla JS met addEventListener
- Fumero brand tokens; WCAG focus-states; <html lang="nl">
- Kennisbank-feiten waar relevant; geen verzonnen prijzen
```

## Interne hooks (voor ontwikkelaars)

Max krijgt deze regels automatisch via:

| Bestand | Rol |
|---------|-----|
| `lib/fumero/max-build-style.ts` | Build-regels + kennisbank-feiten |
| `lib/fumero/max-response-style.ts` | Chat + build in systeemprompt |
| `lib/fumero/tools-service.ts` | Bouwen-tab HTML-generatie |
| `docs/fumero/design-builder.md` | Design context in builder |
| `lib/artifact-generate.ts` | Volledige HTML, geen truncate |
| `.cursor/rules/fumero-max.mdc` | Cursor-regel bij Fumero-projecten |

Referentie op schijf:

- `/home/pietje/fumero-chatbot/index.html` + `BRAND-VOICE.md`
- `/home/pietje/flappy-fumero/index.html`
- `/home/pietje/champions-league/index.html`
- `/home/pietje/AI_HQ/factory-os/klanten/fumero/kennisbank/`
