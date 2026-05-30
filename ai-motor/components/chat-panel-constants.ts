export type ConversationRow = {
  id: number;
  klant: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export const QUICK_ACTIONS = [
  {
    label: "Samenvatting",
    prompt: "Geef een korte samenvatting van wat we bespraken.",
  },
  {
    label: "Actiepunten",
    prompt: "Lijst concrete actiepunten met eigenaar en deadline.",
  },
  {
    label: "Agenda",
    prompt: "Wat staat er komende week op de agenda voor dit bedrijf?",
  },
] as const;

export const SLASH_COMMANDS = [
  {
    cmd: "/help",
    label: "Help",
    hint: "Wat kun je hier?",
    action: "send" as const,
    payload:
      "Leg kort uit wat ik hier kan doen en wanneer ik Agent mode gebruik.",
  },
  {
    cmd: "/clear",
    label: "Leeg scherm",
    hint: "Wis berichten lokaal",
    action: "clear" as const,
  },
  { cmd: "/new", label: "Nieuwe chat", hint: "Nieuw gesprek", action: "new" as const },
  {
    cmd: "/build",
    label: "Builder",
    hint: "App bouwen",
    action: "send" as const,
    payload:
      "Bouw een compacte app. Ik wil: ",
  },
  {
    cmd: "/kennisbank",
    label: "Kennisbank",
    hint: "Documenten",
    action: "nav" as const,
    href: "/kennisbank",
  },
  {
    cmd: "/agents",
    label: "Agenten",
    hint: "Taken met stappen",
    action: "nav" as const,
    href: "/agents",
  },
] as const;
