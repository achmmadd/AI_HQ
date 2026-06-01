# scrape_url (Max · URL Reader)

Platform-architectuur: [docs/platform/url-reader.md](../platform/url-reader.md)

## Chat

- *"Check de actuele prijzen op fumero.nl/shop"*
- `scrape_url: https://fumero.nl/shop/`

Provider: **auto** (Jina indien key, anders native). Geen aparte Grok/Qwen-scrape nodig.

## API

`POST /api/fumero/scrape-url` — response bevat `provider` (`jina` | `native`).

## Automation

`fumero_kennisbank_refresh` — maandag 09:00, pagina's uit tenant-config.

## Env

| Variabele | Verplicht |
|-----------|-----------|
| `JINA_API_KEY` | Nee (aanbevolen productie) |
| `SCRAPE_PROVIDER` | Nee (default `auto`) |
