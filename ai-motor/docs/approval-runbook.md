# Approval Runbook

Motor AI mag operators ondersteunen, maar externe acties blijven human-in-the-loop. Bij twijfel: niet uitvoeren, wel klaarzetten voor goedkeuring.

## Wat Kan Zonder Goedkeuring

- Chatvragen beantwoorden.
- Content genereren zonder publicatie.
- Kennisbank lezen en doorzoeken.
- Rapporten en interne samenvattingen genereren.
- Drafts maken voor social posts, e-mails of documenten.

## Wat Altijd Goedkeuring Nodig Heeft

- Facturen of bonnen verwerken naar Odoo.
- E-mails versturen via Gmail of andere externe mailkanalen.
- Sociale media publiceren.
- Webhooks uitvoeren die content of data naar externe systemen sturen.
- Automation taken met financiële, juridische of klantzichtbare gevolgen.

## Bonnenflow

- Bookkeeping-bot blijft de bron voor bonnen en exposeert `/recent`, `/approve/{token}` en `/reject/{token}`.
- Motor AI toont wachtende bonnen op `/bokas/bonnen`.
- Goedkeuren via Motor AI loopt door naar bookkeeping-bot, wordt verwerkt richting Odoo of retry queue, en wordt als resolved approval in Motor AI gelogd.
- Afwijzen vereist een reden, verwijdert de bon uit de pending queue en logt de afwijzing in Motor AI.
- Telegram blijft fallback: bestaande Telegram-knoppen werken naast Motor AI.

## Bij Afwezigheid

- Alle kritieke approvals blijven wachten in Motor AI en Telegram.
- Bonnen mogen maximaal 7 dagen blijven staan; daarna handmatig controleren en afwijzen of opnieuw indienen.
- Urgente items gaan naar de backup-operator voordat externe acties worden uitgevoerd.
- Backup-operator: vul intern telefoonnummer/contactpersoon in.

## Controle

- `/bokas/bonnen`: toont actuele wachtende bonnen.
- `/approvals`: toont Motor AI audit trail.
- `/dev`: core health moet OK zijn; bookkeeping en Odoo zijn optionele integraties met eigen status.
- Telegram: controleer of de operator bevestigingen ontvangt na approve/reject.
