# Dify Browser Use (plugin)

1. Open Dify: `DIFY_BASE_URL` (bijv. `http://127.0.0.1:5001`) → **Plugins** → Marketplace.
2. Zoek een browser-/web-agent plugin (bijv. “browser use” / aanbieder van je stack).
3. Installeer en koppel API-keys volgens de plugin-docs.
4. Maak een agent-app met **Browser** + eventueel **Code Interpreter**; system prompt in het Nederlands voor ondernemer-taken.
5. Zet een dedicated API key in `.env`, bijv. `DIFY_ENTREPRENEUR_AGENT_API_KEY`, en gebruik die in n8n of aparte routes — niet committen.

Motor AI chat blijft primair via n8n (`factory-os` / optioneel `N8N_ENTREPRENEUR_WEBHOOK`).
