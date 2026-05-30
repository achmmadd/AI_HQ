import { buildStudioUrl, studioChatUrl } from "@/lib/studio-actions";

export const BOKAS_CHAT_SUGGESTIONS = [
  {
    label: "Reserveringen vandaag",
    prompt: "Welke reserveringen staan er vandaag? Geef een kort overzicht met tijden en personen.",
  },
  {
    label: "Menu suggestie",
    prompt: "Stel 3 dag-specials voor op basis van seizoen en populaire gerechten.",
  },
  {
    label: "Personeel planning",
    prompt: "Geef tips voor de dienstindeling van dit weekend (bediening + keuken).",
  },
  {
    label: "Marketing post",
    prompt: "Schrijf een korte Instagram-post voor Bokas restaurant met CTA voor reserveren.",
  },
] as const;

export function bokasStudioUrl(
  path: string,
  params: Record<string, string | undefined>
): string {
  return buildStudioUrl(path, params);
}

export function bokasChatWorkspaceUrl(prompt: string): string {
  return studioChatUrl("/bokas", prompt);
}
