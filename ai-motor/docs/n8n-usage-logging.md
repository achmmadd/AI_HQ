# n8n Usage Logging

Doel: elke succesvolle Factory OS agent-response logt usage naar Motor AI, zodat `/kosten` tokens en kosten toont.

## HTTP Request Node

Plaats deze node direct na de node die de agent-response succesvol teruggeeft.

- Method: `POST`
- URL: `https://motorsai.app/api/usage`
- Authentication: geen extra auth nodig voor deze route
- Send Body: JSON
- Headers:
  - `Content-Type: application/json`

Body:

```json
{
  "model": "factory-os-agent",
  "klant": "fumero",
  "afdeling": "fabriek",
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "duration_ms": 0,
  "success": true,
  "agent_label": "n8n Factory OS",
  "input_preview": "korte input-preview",
  "output_preview": "korte output-preview"
}
```

## Mapping

- `klant`: gebruik de klant uit de incoming webhook payload, bijvoorbeeld `{{$json.klant || "fumero"}}`.
- `prompt_tokens` en `completion_tokens`: vul echte LLM-metrics in als de agent-node die geeft. Als n8n ze niet heeft, zet voorlopig `0`.
- `duration_ms`: verschil tussen start- en eindtijd van de workflow of agent-call.
- `success`: `true` na succesvolle response; log failures apart met `false` als de workflow een error branch heeft.
- `input_preview`: max korte prompt/context-samenvatting, geen secrets.
- `output_preview`: max korte antwoord-samenvatting, geen volledige privédata.

## Controle

Na een succesvolle workflow-run:

```bash
curl -s "https://motorsai.app/api/usage?period=today" | jq .
```

In Motor AI moet `/kosten` daarna calls/tokens/kosten voor `factory-os-agent` tonen.
