# scrape_url (Max · Jina Reader)

Max kan live pagina-inhoud ophalen van toegestane domeinen en die als context in chat gebruiken.

## Omgeving

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `JINA_API_KEY` | Ja (voor scrape) | API key van [jina.ai](https://jina.ai) |
| `QDRANT_URL` | Voor kennisbank-upsert | Bestaande Qdrant-stack |
| `QDRANT_FUMERO_KENNISBANK_COLLECTION` | Nee | Default: `fumero_kennisbank` |
| `FUMERO_KENNISBANK_NOTIFY_MAX` | Nee | Zet op `0` om Telegram na refresh uit te zetten |

Voeg `JINA_API_KEY` toe in `~/AI_HQ/.env` of `.env.local` — commit geen echte keys.

## Domein-whitelist

- `fumero.nl`
- `bigfarmers.nl`
- `hhcshop.nl`
- `nos.nl`

## API

`POST /api/fumero/scrape-url` (Fumero-workspace auth)

```json
{
  "url": "https://fumero.nl/shop/",
  "reason": "handmatige test",
  "upsert_qdrant": false
}
```

## Chat

Bij Fumero Max-chat wordt Jina automatisch aangeroepen wanneer:

- de gebruiker een **live/check**-intent heeft én een whitelist-URL noemt, of
- `scrape_url: https://…` in het bericht staat.

Voorbeeld: *"Check de actuele prijzen op fumero.nl/shop"*

## Automation

Taak `fumero_kennisbank_refresh` — **maandag 09:00** (cron via `POST /api/cron/automation`).

Scrapet vaste shop-pagina's en upsert naar Qdrant `fumero_kennisbank`. Optionele Telegram-melding.

Handmatig: Fumero Automations hub → **Run nu**, of automation API.
