# Factory OS — Cursor todo lijst

### IN UITVOERING

- [ ] Optie A — n8n native token streaming (optioneel)

### FASE 2 — SYSTEEM FUNCTIES

- [x] Agenda + Todo SQLite backend
- [x] OpenClaw sync → auto agenda
- [x] Afdelingen live status API
- [x] Notifications + Telegram alerts
- [x] Approvals human-in-the-loop
- [x] NUC health monitor dagrapport

### CHAT FEATURES

- [x] Voice input (Web Speech API)
- [x] Bestanden uploaden + analyseren
- [x] Agent mode toggle
- [x] Snelle acties knoppen
- [x] Streaming responses (SSE + chunked typing na n8n)
- [x] Chat geschiedenis per bedrijf

### BOKAS HORECA APP

- [x] Reserveringen systeem
- [x] Personeel planning UI (shifts)
- [x] Menu beheer (API + weergave)
- [ ] WhatsApp integratie
- [x] Dashboard Bokas (basis)
- [x] Review responder — /bokas/reviews + n8n Bokas — Review Responder

### FUMERO

- [x] Chatbot embed (/embed/fumero + public/fumero-widget.js)
- [x] Content pipeline — /fumero, /api/content/*, templates seed

### FACTORY OS ZELF

- [x] Todo systeem (CURSOR_TODO.md + API)
- [x] Kosten tracker — /kosten, /api/usage, usage_logs
- [x] Self-improve hook — POST /api/factory/improve (+ Telegram)
- [ ] Cursor automation via chat (n8n → cursor-tasks end-to-end)
- [ ] Zichzelf verbeteren workflow (volledige loop)

### SPRINT 5 — MOTOR AI (motorsai.app)

- [x] Landing pagina + basic auth (cookie + login)
- [x] Live builder demo (`/builder` + Factory OS `app_build`)
- [x] Agent mode hook (`hooks/useAgentMode.ts`)
- [x] Kennisbank vullen via UI (`/api/knowledge/add`)
- [x] Theme + bedrijf persistent (localStorage via zustand)

### PRODUCTION — Klaar voor eerste klant

- [ ] motorsai.app via Cloudflare tunnel live (NUC)
- [ ] Fumero kennisbank vullen (5+ producten)
- [ ] Bokas info compleet (uren, capaciteit)
- [ ] Live builder testen (minstens 1 demo app)
- [ ] Agent mode testen (minstens 3 taken)
- [ ] Login wachtwoord veilig opslaan (`MOTORSAI_PASSWORD`, geen defaults in prod)
- [ ] Fumero widget op fumero.nl plaatsen
- [ ] Bokas WhatsApp koppelen + testen

### VOLGENDE SPRINT

- [ ] Google Business Profile API — auto-post replies
- [ ] TikTok auto-post via API
- [ ] Instagram auto-post via API
- [ ] WhatsApp bot voor Bokas (Twilio)
- [ ] App Store skills installeren
- [ ] Multi-bedrijf switcher verbeteren
- [ ] Domein + permanente tunnel
- [ ] Onboarding nieuwe klanten
- [ ] Backup restore test

### USER REQUESTS
- [ ] Builder: Een rekenmachine
- [ ] Builder: De Prompt

"Bouw een full-stack webapplicatie voor 'Bokas' met twee hoofdfuncties: een publieke bestel-omgeving voor afhalen en een in-house bestel-interface voor gasten in de zaak.

1. Visuele & Functionele Inspiratie





Design & UX: Baseer de 'Ordering Flow' op de look-and-feel van joejuice.com. Minimalistisch, grote productafbeeldingen, zijwaartse navigatie voor categorieën en een snelle checkout.



Menu Content: Gebruik de menustructuur van bokas.nl/menu/ als basis voor de producten (bijv. sandwiches, sappen, bites).

2. Kernfunctionaliteiten





Storefront (Afhalen): Gebruikers kunnen items selecteren, een afhaaltijd kiezen en betalen.



In-house Modus: Een specifieke interface (bijv. via een /table/ID route) waar gasten in de zaak kunnen bestellen.



Winkelmandje: Een persistente sidebar of bottom-drawer die de totaalprijs en geselecteerde items toont.



Product Modals: Wanneer een gebruiker op een item klikt, open een overlay voor aanpassingen (bijv. extra ingrediënten of allergieën).

3. Technische Stack (Aanbeveling)





Framework: Next.js (App Router).



Styling: Tailwind CSS voor die strakke Joe & The Juice esthetiek.



State Management: Gebruik Zustand of React Context voor het winkelmandje.



Backend: Prisma met een lokale SQLite database (aangezien de server wordt geëlimineerd en we op eigen hardware draaien).

4. Directe Actie

Begin met het opzetten van de basisstructuur:





Maak een constants/menu.ts bestand aan met data van het Bokas menu.



Bouw de navigatiebalk en de 'Category Grid' in de stijl van Joe & The Juice.



Zet de 'Cart Logic' op zodat items toegevoegd en verwijderd kunnen worden."
- [ ] Builder: Een timer met start/stop/reset knoppen
- [ ] Builder: Een kleurkiezer tool
- [ ] Builder: bouw een simple rekenmachine
- [ ] Builder: maak Een simple rekenmachine
- [ ] Builder: Een BMI calculator
- [ ] Builder: Een rekenmachine
- [ ] Builder: Een rekenmachine
- [ ] Builder: Bouw een full-stack webapplicatie voor 'Bokas' met twee hoofdfuncties: een publieke bestel-omgeving voor afhalen en een in-house bestel-interface voor gasten in de zaak.

1. Visuele & Functionele Inspiratie
Design & UX: Baseer de 'Ordering Flow' op de look-and-feel van joejuice.com. Minimalistisch, grote productafbeeldingen, zijwaartse navigatie voor categorieën en een snelle checkout.

Menu Content: Gebruik de menustructuur van bokas.nl/menu/ als basis voor de producten (bijv. sandwiches, sappen, bites).

2. Kernfunctionaliteiten
Storefront (Afhalen): Gebruikers kunnen items selecteren, een afhaaltijd kiezen en betalen.

In-house Modus: Een specifieke interface (bijv. via een /table/ID route) waar gasten in de zaak kunnen bestellen.

Winkelmandje: Een persistente sidebar of bottom-drawer die de totaalprijs en geselecteerde items toont.

Product Modals: Wanneer een gebruiker op een item klikt, open een overlay voor aanpassingen (bijv. extra ingrediënten of allergieën).

3. Technische Stack (Aanbeveling)
Framework: Next.js (App Router).

Styling: Tailwind CSS voor die strakke Joe & The Juice esthetiek.

State Management: Gebruik Zustand of React Context voor het winkelmandje.

Backend: Prisma met een lokale SQLite database (aangezien de server wordt geëlimineerd en we op eigen hardware draaien).

4. Directe Actie
Begin met het opzetten van de basisstructuur:

Maak een constants/menu.ts bestand aan met data van het Bokas menu.

Bouw de navigatiebalk en de 'Category Grid' in de stijl van Joe & The Juice.

Zet de 'Cart Logic' op zodat items toegevoegd en verwijderd kunnen worden."
- [ ] Builder: Een rekenmachine
- [ ] Builder: Om een complex platform te bouwen dat zowel een publieke webshop (gebaseerd op Joe & The Juice) als een in-house bestelsysteem (gebaseerd op Bokas) combineert, moet je Cursor heel specifieke instructies geven over de architectuur en de "flow".

Hier is een krachtige prompt die je direct in de **Composer (Cmd+I / Ctrl+I)** of een nieuwe chat kunt plakken:

---

## De Prompt

"Bouw een full-stack webapplicatie voor 'Bokas' met twee hoofdfuncties: een publieke bestel-omgeving voor afhalen en een in-house bestel-interface voor gasten in de zaak.

### 1. Visuele & Functionele Inspiratie
* **Design & UX:** Baseer de 'Ordering Flow' op de look-and-feel van `joejuice.com`. Minimalistisch, grote productafbeeldingen, zijwaartse navigatie voor categorieën en een snelle checkout.
* **Menu Content:** Gebruik de menustructuur van `bokas.nl/menu/` als basis voor de producten (bijv. sandwiches, sappen, bites).

### 2. Kernfunctionaliteiten
* **Storefront (Afhalen):** Gebruikers kunnen items selecteren, een afhaaltijd kiezen en betalen.
* **In-house Modus:** Een specifieke interface (bijv. via een `/table/ID` route) waar gasten in de zaak kunnen bestellen.
* **Winkelmandje:** Een persistente sidebar of bottom-drawer die de totaalprijs en geselecteerde items toont.
* **Product Modals:** Wanneer een gebruiker op een item klikt, open een overlay voor aanpassingen (bijv. extra ingrediënten of allergieën).

### 3. Technische Stack (Aanbeveling)
* **Framework:** Next.js (App Router).
* **Styling:** Tailwind CSS voor die strakke Joe & The Juice esthetiek.
* **State Management:** Gebruik Zustand of React Context voor het winkelmandje.
* **Backend:** Prisma met een lokale SQLite database (aangezien de server wordt geëlimineerd en we op eigen hardware draaien).

### 4. Directe Actie
Begin met het opzetten van de basisstructuur:
1.  Maak een `constants/menu.ts` bestand aan met data van het Bokas menu.
2.  Bouw de navigatiebalk en de 'Category Grid' in de stijl van Joe & The Juice.
3.  Zet de 'Cart Logic' op zodat items toegevoegd en verwijderd kunnen worden."
https://www.joejuice.com/store/668 en https://bokas.nl/menu/
- [ ] Build: ik wil https://www.joejuice.com/store/668 dit bouwen voor bokas waar mensen hun bestelingen kunen plaatsen en afhalen maar ook gebruiken voor in de zaak zodat ze kunnen bestelen
- [ ] Build: ik wil https://www.joejuice.com/store/668 dit bouwen voor bokas waar mensen hun bestelingen kunen plaatsen en afhalen maar ook gebruiken voor in de zaak zodat ze kunnen bestelen
