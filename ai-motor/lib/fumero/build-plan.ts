import { getTemplate, type FumeroDeployType } from "@/lib/fumero/tool-templates";
import { isMultiPagePrompt } from "@/lib/fumero/build-prompt-heuristics";

const INTERACTION_HINTS: Record<string, string> = {
  chat: "Chat-widget met toggle, quick replies, typing-indicator en kennisbank-antwoorden",
  kb_chat: "FAQ-chatbot met KB-object, quick replies en textContent voor berichten",
  calculator: "Rekenmachine met toetsenbord-grid en live display",
  quiz: "Meerstaps keuzehulp met knoppen en CTA",
  age: "Leeftijdscheck met ja/nee en toegangsgate",
  bundle: "Bundle-configurator met selectie en totaal",
  review: "Reviewformulier met sterren en tekstveld",
  loyalty: "Dashboard met punten en beloningen",
  staff_app: "Interne lijsten en snelle acties",
  receipt_scanner: "Upload UI met status",
  order_tracker: "Ordernummer invoer en timeline",
};

/**
 * Kort gestructureerd plan vóór de eerste build (plan-modus of eerste generate).
 */
export function formatStructuredBuildPlan(opts: {
  prompt: string;
  templateId?: string;
  deployType: FumeroDeployType;
}): string {
  const tpl = opts.templateId ? getTemplate(opts.templateId) : undefined;
  const doel = opts.prompt.trim().slice(0, 280);
  const template = tpl?.title ?? (opts.templateId ?? "Eigen tool");
  const interacties =
    (opts.templateId && INTERACTION_HINTS[opts.templateId]) ??
    "Klikbare knoppen en inputs met vanilla JavaScript";
  const feiten =
    opts.templateId === "chat" || opts.templateId === "kb_chat"
      ? "Kennisbank: bankoverschrijving + crypto (DePay), geen iDEAL; min. order €49; levertijd volgende werkdag"
      : "Fumero brand: professioneel, je/jij, geen emoji in UI";

  return [
    "**Plan vóór bouwen**",
    "",
    `**Doel:** ${doel}`,
    `**Sjabloon:** ${template} (${opts.deployType})`,
    `**Interacties:** ${interacties}`,
    `**Feiten:** ${feiten}`,
    "",
    "Ik start nu met genereren — preview verschijnt rechts zodra de HTML klaar is.",
  ].join("\n");
}

/**
 * Gestructureerd plan vóór full_app generate (Lovable plan → build).
 */
export function formatFullAppBuildPlan(prompt: string): string {
  const doel = prompt.trim().slice(0, 280);
  const multi = isMultiPagePrompt(prompt);
  const paginas = multi
    ? "Home, Shop, Checkout, Dashboard — client-side routes in één HTML-document"
    : "Enkele pagina met CRUD via data-API";
  const routing = multi
    ? "Hash-router (#/shop) of data-page switching, shared <nav> met active state"
    : "Eén view met formulier, lijst en filters";
  const feiten =
    "Kennisbank: bankoverschrijving + crypto (DePay), geen iDEAL; min. order €49; levertijd volgende werkdag; 18 jaar en ouder; je/jij; geen emoji";

  return [
    "**Plan vóór bouwen (Website/App)**",
    "",
    `**Doel:** ${doel}`,
    `**Type:** Volledige data-gedreven app (full_app)`,
    `**Pagina's:** ${paginas}`,
    `**Navigatie:** ${routing}`,
    `**Data:** SQLite via /api/apps/{slug}/data (products, orders, …)`,
    `**Feiten:** ${feiten}`,
    "",
    "Ik start nu met genereren — preview verschijnt rechts zodra de app klaar is.",
  ].join("\n");
}
