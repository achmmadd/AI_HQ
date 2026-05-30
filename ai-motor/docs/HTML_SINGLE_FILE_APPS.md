# HTML mini-apps in Motor (één bestand)

Motor bewaart **één HTML-string** per app en toont die via `iframe` + `srcDoc`. Er is **geen** aparte hosting van `pagina2.html` of een echte server-route binnen die app.

## Wat werkt

- **Tabs / secties**: toon/verberg met JavaScript binnen hetzelfde document.
- **Hash-routing**: bijv. `#/about`, `location.hash`, hash change listener.
- **`history.pushState`**: mag, zolang alles in hetzelfde document blijft en er geen echte extra bestanden nodig zijn.

## Wat niet werkt (zonder deploy-wijzigingen)

- Meerdere losse `.html`-bestanden.
- Normale multi-page links naar paths die een tweede bestand verwachten.

## Tip voor prompts

Vraag expliciet om *“één HTML-bestand met hash-routing voor meerdere schermen”* als je meer dan één “pagina” wilt.
