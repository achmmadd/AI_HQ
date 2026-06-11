export type BouwenFollowUpSuggestion = {
  label: string;
  prompt: string;
};

const MAX_FOLLOW_UPS = 2;

/** Contextuele vervolgchips na afgeronde bouw-/wijzigingsactie (max 2). */
export function deriveBouwenFollowUpSuggestions(opts: {
  kind: "build" | "iterate";
  deployType?: string | null;
  templateId?: string | null;
  toolName?: string;
}): BouwenFollowUpSuggestion[] {
  const out: BouwenFollowUpSuggestion[] = [];

  if (opts.kind === "build") {
    out.push({
      label: "Teksten persoonlijker",
      prompt:
        "Maak alle teksten persoonlijker in je/jij-vorm, kort en duidelijk voor bezoekers.",
    });
    if (opts.templateId === "form" || opts.templateId === "landing") {
      out.push({
        label: "CTA scherper",
        prompt:
          "Maak de primaire call-to-action korter, duidelijker en visueel sterker.",
      });
    } else if (opts.deployType === "chat" || opts.deployType === "widget") {
      out.push({
        label: "FAQ toevoegen",
        prompt:
          "Voeg 3 veelgestelde vragen toe met korte antwoorden over levering en betaling.",
      });
    } else {
      out.push({
        label: "Fumero-groen accent",
        prompt:
          "Gebruik Fumero-groen (#69C400) als accent voor knoppen en belangrijke acties.",
      });
    }
  } else {
    out.push({
      label: "Nog iets tweaken",
      prompt: "Pas de layout iets compacter aan voor mobiel.",
    });
    out.push({
      label: "Tekst scherper",
      prompt: "Maak koppen en knoppen korter en directer.",
    });
  }

  if (opts.toolName) {
    void opts.toolName;
  }

  return out.slice(0, MAX_FOLLOW_UPS);
}
