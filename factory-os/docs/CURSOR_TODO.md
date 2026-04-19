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
