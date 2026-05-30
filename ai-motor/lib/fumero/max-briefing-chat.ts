import type { FumeroBriefingPayload } from "@/lib/fumero/briefing";
import { buildStudioUrl } from "@/lib/studio-actions";

export type MaxChatAction =
  | { type: "redirect"; href: string; notice: string }
  | { type: "inline_briefing" };

/** Alleen expliciete navigatie — geen generatie-intent (die blijft in chat/API). */
const CONTENT_STUDIO_NAV_RE =
  /\b(open|ga\s+naar|naar)\s+(de\s+)?content\s*studio\b/i;
const CONTENT_STUDIO_SHORT_RE = /\bcontent\s*studio\s*(openen)?\b/i;
const EMAIL_STUDIO_NAV_RE =
  /\b(open|ga\s+naar|naar)\s+(de\s+)?(e-?mail\s*flows?|email\s*studio)\b/i;
const ORDERS_NAV_RE =
  /\b(open|ga\s+naar|naar)\s+(de\s+)?(orders?|bestellingen)\b/i;
const ORDERS_QUERY_RE = /\b(orders?\s*vandaag|bestellingen\s*vandaag|omzet\s*vandaag)\b/i;
const BRIEFING_RE =
  /\b(briefing|dagelijkse\s*briefing|wat\s+speelt\s+er|overzicht\s+vandaag|status\s*overzicht)\b/i;

export function formatMaxBriefingSystemBlock(b: FumeroBriefingPayload): string {
  const lines = [
    "### Max — dagelijkse Fumero briefing (live data)",
    b.summary,
    "",
    "Actie nodig:",
    ...b.actions.map((a) => `- ${a}`),
    "",
    "Kansen:",
    ...b.opportunities.map((o) => `- ${o}`),
    "",
    "Status:",
    ...b.status.map((s) => `- ${s}`),
    "",
    "Je bent Max, proactieve AI-collega van Fumero (geen generieke chatbot). Wees concreet, verwijs naar studio's waar passend (Content, Email, Orders). Geen pop-ups — stuur door met korte instructie of voer inline uit.",
  ];
  return lines.join("\n");
}

export function formatMaxOpeningMessage(b: FumeroBriefingPayload): string {
  const actionLines =
    b.actions.length > 0
      ? b.actions
          .slice(0, 3)
          .map((a) => `• ${a}`)
          .join("\n")
      : "• Geen urgente acties — goed moment om content te plannen.";
  return `Goedemorgen — ik heb de briefing voor je klaar.\n\n**${b.summary}**\n\n**Actie nodig**\n${actionLines}\n\nWaar wil je mee starten? Kies een suggestie onderaan of stel je vraag.`;
}

export function formatMaxBriefingDetailMarkdown(b: FumeroBriefingPayload): string {
  const fmtList = (items: string[]) =>
    items.length ? items.map((x) => `- ${x}`).join("\n") : "- Geen items";
  return [
    "## Dagelijkse briefing",
    "",
    b.summary,
    "",
    "### Actie nodig",
    fmtList(b.actions),
    "",
    "### Kansen",
    fmtList(b.opportunities),
    "",
    "### Status",
    fmtList(b.status),
    "",
    `_Bijgewerkt: ${formatBriefingTime(b.generated_at)}_`,
  ].join("\n");
}

export function formatBriefingTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function pickBriefingQuickActions(
  b: FumeroBriefingPayload,
  limit = 3
): Array<{ label: string; prompt: string }> {
  const fromActions = b.actions.slice(0, limit).map((prompt, i) => ({
    label: truncateLabel(prompt, 32) || `Actie ${i + 1}`,
    prompt,
  }));
  if (fromActions.length >= limit) return fromActions;

  const fallbacks = [
    {
      label: "Content plannen",
      prompt: "Help me vandaag 1 stuk content te plannen — schrijf een sterke prompt die ik direct kan gebruiken.",
    },
    {
      label: "Orders vandaag",
      prompt: "Geef een overzicht van Fumero orders vandaag en wat ik moet opvolgen.",
    },
  ];
  return [...fromActions, ...fallbacks].slice(0, limit);
}

function truncateLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function resolveMaxChatAction(
  prompt: string,
  briefing: FumeroBriefingPayload | null
): MaxChatAction | null {
  const t = prompt.trim();
  if (!t) return null;

  if (BRIEFING_RE.test(t)) {
    return { type: "inline_briefing" };
  }

  if (CONTENT_STUDIO_NAV_RE.test(t) || CONTENT_STUDIO_SHORT_RE.test(t)) {
    return {
      type: "redirect",
      href: buildStudioUrl("/fumero/chat", { q: t }),
      notice: "Chat openen voor content…",
    };
  }

  if (EMAIL_STUDIO_NAV_RE.test(t)) {
    return {
      type: "redirect",
      href: buildStudioUrl("/fumero/automations", { prompt: t, run: "1" }),
      notice: "Automations openen…",
    };
  }

  if (ORDERS_NAV_RE.test(t) || ORDERS_QUERY_RE.test(t)) {
    const href = buildStudioUrl("/fumero/orders", { q: t });
    return { type: "redirect", href, notice: "Orders openen…" };
  }

  return null;
}
