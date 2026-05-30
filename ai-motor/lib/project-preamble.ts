import { buildChatSystemPreamble } from "@/lib/chat-prompt";

const DOMAIN_HINTS: Record<string, string> = {
  fumero:
    "Fumero: premium e-commerce / lifestyle, discreet, 18+, producten en content.",
  bokas:
    "Bokas: restaurant — reserveringen, menu, personeel, shifts, gasten.",
  system: "Algemene MotorsAI-fabriek: dashboards, tools, interne apps.",
};

/**
 * Systeemprompt voor project-build: kennisbank + klant-domein.
 */
export async function buildProjectBuildPreamble(
  klant: string,
  userPrompt: string,
  activeProjectId?: number
): Promise<string> {
  const base = await buildChatSystemPreamble(klant, userPrompt, {
    activeProjectId,
  });
  const k = klant.trim().toLowerCase();
  const domain = DOMAIN_HINTS[k] ?? `Klant "${klant}": interpreteer bedrijfs- en domeintermen in het Nederlands.`;
  return (
    base +
    `\n### Project-build modus\n` +
    `${domain}\n` +
    `Je bent een senior full-stack engineer (Lovable/Codex-niveau): kies stack uit de prompt.\n` +
    `- vanilla: index.html + styles.css + app.js voor simpele sites\n` +
    `- react: Vite + React 18 + TypeScript (src/App.tsx, package.json, …)\n` +
    `- next: Next.js 14 App Router + TypeScript (app/page.tsx, components/, …)\n` +
    `Schrijf echte, werkende code — geen placeholders. NL UI-teksten. Domein: informele prompts begrijpen.\n`
  );
}
