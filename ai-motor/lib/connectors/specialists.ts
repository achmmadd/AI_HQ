import {
  FUMERO_TOOL_TEMPLATES,
  getTemplate,
  type FumeroToolTemplateId,
} from "@/lib/fumero/tool-templates";

export const FUMERO_DESIGN_SYSTEM_BLOCK = `### Webdesigner — Fumero design system
- Accentkleur: #69C400 (primair), hover #5db000
- Typografie: Geist, system-ui, sans-serif
- Achtergrond: #FFFFFF / #FAFAFA, borders #E5E5E5, tekst #171717 / #525252
- Spacing: 8px-grid, padding 16–24px, border-radius 8–12px
- Widget max-breedte ~480px, mobiel-first
- Geen emoji in UI-chrome; WCAG AA contrast voor body-tekst`;

export function applyDesignerHints(
  prompt: string,
  templateId?: FumeroToolTemplateId | string
): string {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  const tplHint = tpl?.promptSeed
    ? `\nSjabloon-styling (${tpl.title}): ${tpl.promptSeed}`
    : "";
  return `${prompt.trim()}\n\n${FUMERO_DESIGN_SYSTEM_BLOCK}${tplHint}`.trim();
}

export function formatTemplatesConnectorBlock(): string {
  const lines = [
    "### Templates — beschikbare tool-sjablonen",
    "Kies of verwijs naar een sjabloon bij bouwen:",
    "",
  ];
  for (const t of FUMERO_TOOL_TEMPLATES) {
    lines.push(`- **${t.title}** (\`${t.id}\`): ${t.description}`);
  }
  return lines.join("\n");
}

export type UxCheckItem = {
  id: string;
  label: string;
  pass: boolean;
  hint?: string;
};

export function runRuleBasedUxCheck(html: string): {
  items: UxCheckItem[];
  score: number;
} {
  const code = html.trim();
  const items: UxCheckItem[] = [
    {
      id: "viewport",
      label: "Viewport meta (mobiel)",
      pass: /<meta[^>]+name=["']viewport/i.test(code),
      hint: 'Voeg <meta name="viewport" content="width=device-width, initial-scale=1"> toe in <head>.',
    },
    {
      id: "lang",
      label: "Taal op <html>",
      pass: /<html[^>]+lang=/i.test(code),
      hint: 'Zet lang="nl" op het <html>-element.',
    },
    {
      id: "title",
      label: "Paginatitel",
      pass: /<title>[^<]{2,}<\/title>/i.test(code),
      hint: "Voeg een korte, beschrijvende <title> toe.",
    },
    {
      id: "interactive",
      label: "JavaScript-interactiviteit",
      pass: /<script[\s>]/i.test(code),
      hint: "Voeg vanilla JS toe zodat knoppen en inputs werken.",
    },
    {
      id: "touch",
      label: "Touch-vriendelijke knoppen",
      pass:
        /min-height:\s*(4[0-9]|[5-9]\d)px/i.test(code) ||
        /padding:\s*(1[2-9]|[2-9]\d)px/i.test(code) ||
        /<button/i.test(code),
      hint: "Knoppen minimaal ~44px hoog of ruime padding voor touch.",
    },
    {
      id: "contrast",
      label: "Geen wit-op-wit",
      pass: !(
        /color:\s*#fff/i.test(code) &&
        /background(?:-color)?:\s*#fff/i.test(code)
      ),
      hint: "Controleer tekst/achtergrond-contrast (min. WCAG AA).",
    },
    {
      id: "labels",
      label: "Labels bij formuliervelden",
      pass:
        !/<input/i.test(code) ||
        /<label|aria-label=|aria-labelledby=/i.test(code),
      hint: "Koppel <label> of aria-label aan inputs.",
    },
    {
      id: "focus",
      label: "Focus-styling",
      pass: /:focus|outline/i.test(code),
      hint: "Voeg zichtbare :focus-styling toe voor toetsenbordgebruikers.",
    },
  ];

  const passCount = items.filter((i) => i.pass).length;
  const score = items.length
    ? Math.round((passCount / items.length) * 100)
    : 0;
  return { items, score };
}

export function formatUxChecklistMarkdown(
  items: UxCheckItem[],
  score: number,
  llmSummary?: string
): string {
  const lines = [
    `**UX-check** — score ${score}/100`,
    "",
    ...items.map(
      (i) =>
        `- ${i.pass ? "✓" : "○"} ${i.label}${i.pass ? "" : ` — _${i.hint}_`}`
    ),
  ];
  if (llmSummary?.trim()) {
    lines.push("", "**Aanbevelingen:**", llmSummary.trim());
  }
  return lines.join("\n");
}
