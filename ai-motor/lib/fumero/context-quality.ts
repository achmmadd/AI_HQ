export type ContextQualityIssue = {
  id: string;
  severity: "info" | "warning";
  message: string;
};

export const FUMERO_CONTEXT_EXAMPLE = `## Bedrijf
Fumero — premium vape en lifestyle in Nederland.

## Doelgroep
Volwassen consumenten (18+), NL, mobiel-first.

## Tone of voice
Vriendelijk, direct, professioneel. Geen emoji in klantcommunicatie.

## Belangrijke feiten
- Levering: doordeweeks vóór 17:00 → volgende werkdag
- Retour: 14 dagen ongeopend
- Contact: info@fumero.nl

## Procedures
Bij klachten: eerst ordernummer vragen, daarna status checken in shop.`;

export function assessTeamContextQuality(content: string): ContextQualityIssue[] {
  const text = content.trim();
  const issues: ContextQualityIssue[] = [];

  if (!text) {
    issues.push({
      id: "empty",
      severity: "warning",
      message: "Nog geen teamcontext — agents missen bedrijfsachtergrond.",
    });
    return issues;
  }

  if (text.length < 120) {
    issues.push({
      id: "short",
      severity: "warning",
      message: "Context is kort — voeg doelgroep, tone-of-voice en procedures toe.",
    });
  }

  if (/<[a-z][\s\S]*>/i.test(text)) {
    issues.push({
      id: "html",
      severity: "warning",
      message: "HTML gedetecteerd — gebruik platte tekst voor betere resultaten.",
    });
  }

  const lower = text.toLowerCase();
  if (!/(tone|toon|stem|voice)/i.test(lower)) {
    issues.push({
      id: "tone",
      severity: "info",
      message: "Overweeg een tone-of-voice sectie toe te voegen.",
    });
  }

  if (!/(doelgroep|klant|publiek|audience)/i.test(lower)) {
    issues.push({
      id: "audience",
      severity: "info",
      message: "Beschrijf je doelgroep zodat antwoorden gerichter zijn.",
    });
  }

  return issues;
}
