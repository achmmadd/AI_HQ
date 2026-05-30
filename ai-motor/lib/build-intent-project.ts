import { isBuildLikePrompt } from "@/lib/build-intent";

/** NL business/domein-termen (klanten, horeca, retail). */
export function isDomainBusinessPrompt(lower: string): boolean {
  const domain = [
    "fumero",
    "bokas",
    "restaurant",
    "horeca",
    "reservering",
    "reserveringen",
    "menu",
    "bestelling",
    "klantportaal",
    "medewerker",
    "personeel",
    "voorraad",
    "factuur",
    "offerte",
    "crm",
    "agenda",
    "rooster",
    "shift",
    "reviews",
    "google reviews",
    "social",
    "content",
    "webshop",
    "winkel",
  ];
  return domain.some((d) => lower.includes(d));
}

/** Eerste project-build in project-modus (ruimer dan alleen “maak”). */
export function isProjectStartPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (isBuildLikePrompt(t)) return true;
  if (t.length >= 12 && isDomainBusinessPrompt(t.toLowerCase())) return true;
  return false;
}

/** Iteratie op bestaand project (“pas X aan”, “voeg Y toe”). */
export function isProjectIterationPrompt(prompt: string): boolean {
  const l = prompt.toLowerCase().trim();
  if (!l) return false;
  if (
    /\b(pas|wijzig|verander|update|fix|voeg|verwijder|zet|maak|kleur|header|footer|nav|menu|knop|tekst|titel|dark|light|groter|kleiner|animatie)\b/.test(
      l
    )
  ) {
    return true;
  }
  if (l.length < 120 && /\b(aan|toe|weg|erin|erbij)\b/.test(l)) return true;
  return false;
}

/** Ruimere build-detectie incl. domein (voor project-modus). */
export function isProjectLikePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (isBuildLikePrompt(prompt)) return true;
  return isDomainBusinessPrompt(lower);
}
