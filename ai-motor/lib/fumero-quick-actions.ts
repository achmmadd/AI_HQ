/** Routes, prompts en deep links voor Fumero Studio (Motor AI engine). */

import { buildStudioUrl, studioChatUrl } from "@/lib/studio-actions";

export type FumeroStudioContentType =
  | "product_photo"
  | "banner"
  | "social_post"
  | "social_video"
  | "product_text"
  | "email_template"
  | "seo_article";

export type FumeroTypePillId =
  | "email"
  | "photo"
  | "banner"
  | "social"
  | "text"
  | "flow";

export type FumeroQuickActionId =
  | "product_photo"
  | "order_confirmation"
  | "campaign_banner"
  | "review_flow"
  | "social_posts"
  | "abandoned_cart";

/** Lucide icon keys for quick actions (no emoji in chrome). */
export type FumeroQuickActionIcon =
  | "camera"
  | "mail"
  | "megaphone"
  | "message-circle"
  | "star"
  | "shopping-cart";

export type FumeroChatStarterWire = "foto" | "orders" | "canvas" | "coder";

export type FumeroChatStarterCardId =
  | "product_photo"
  | "open_orders"
  | "seo_blog"
  | "staff_tool";

export const FUMERO_TYPE_PILLS: Array<{ id: FumeroTypePillId; label: string }> = [
  { id: "email", label: "E-mail" },
  { id: "photo", label: "Productfoto" },
  { id: "banner", label: "Banner" },
  { id: "social", label: "Social" },
  { id: "text", label: "Tekst" },
  { id: "flow", label: "Flow" },
];

/** Example prompts for Bouwen empty state and template chips. */
export const BOUWEN_EXAMPLE_PROMPTS = [
  {
    label: "Chatbot",
    prompt: "Maak een chatbot voor klantvragen op fumero.nl",
  },
  {
    label: "Landingspagina",
    prompt: "Bouw een landingspagina met hero, voordelen en contact-CTA",
  },
  {
    label: "Bestelformulier",
    prompt: "Maak een bestelformulier met productkeuze en opmerkingen",
  },
  {
    label: "Productwidget",
    prompt: "Compacte productwidget met prijs en bestelknop voor de shop",
  },
] as const;

export const FUMERO_CHAT_SUGGESTIONS = [
  {
    label: "Chatbot bouwen",
    prompt: "Maak een chatbot voor klantvragen op mijn website",
  },
  {
    label: "Landingspagina",
    prompt:
      "Bouw een landingspagina voor mijn zaak: hero, voordelen en contact-CTA",
  },
  {
    label: "Bestelformulier",
    prompt:
      "Maak een bestelformulier met naam, e-mail, productkeuze en opmerkingen",
  },
  {
    label: "Waar is mijn order?",
    prompt: "Waar is mijn bestelling en wanneer wordt die bezorgd?",
  },
] as const;

/** Empty-state starter cards (chat home). */
export const FUMERO_CHAT_STARTER_CARDS: Array<{
  id: FumeroChatStarterCardId;
  wire: FumeroChatStarterWire;
  title: string;
  description: string;
}> = [
  {
    id: "staff_tool",
    wire: "coder",
    title: "Bouw een chatbot of tool",
    description: "Widget, formulier, landingspagina of mini-app voor je bedrijf",
  },
  {
    id: "open_orders",
    wire: "orders",
    title: "Check openstaande orders",
    description: "Recente bestellingen en wat er vandaag binnenkwam",
  },
  {
    id: "seo_blog",
    wire: "canvas",
    title: "Schrijf een SEO blog",
    description: "Artikel met structuur, meta en body in Schrijven",
  },
  {
    id: "product_photo",
    wire: "foto",
    title: "Genereer een productfoto",
    description: "Premium webshop-beeld — open Studio",
  },
];

export const FUMERO_QUICK_ACTIONS: Array<{
  id: FumeroQuickActionId;
  icon: FumeroQuickActionIcon;
  title: string;
  desc: string;
}> = [
  {
    id: "product_photo",
    icon: "camera",
    title: "Productfoto genereren",
    desc: "Premium lifestyle of witte achtergrond voor je webshop",
  },
  {
    id: "order_confirmation",
    icon: "mail",
    title: "Bestelbevestiging schrijven",
    desc: "Persoonlijke bedankmail direct na aankoop",
  },
  {
    id: "campaign_banner",
    icon: "megaphone",
    title: "Campagne banner",
    desc: "Sale, seizoen of nieuwe collectie banners",
  },
  {
    id: "review_flow",
    icon: "message-circle",
    title: "Review verzoek flow",
    desc: "Automatisch na bezorging, meer reviews via AI",
  },
  {
    id: "social_posts",
    icon: "message-circle",
    title: "Social media posts",
    desc: "Instagram, Facebook of TikTok content pakket",
  },
  {
    id: "abandoned_cart",
    icon: "shopping-cart",
    title: "Verlaten winkelwagen",
    desc: "Automatische flow die omzet terughaalt",
  },
];

const QUICK_ACTION_DEFAULTS: Record<
  FumeroQuickActionId,
  { path: string; params: Record<string, string> }
> = {
  product_photo: {
    path: "/fumero/chat",
    params: {
      q: "Genereer een premium productfoto voor onze bestseller HHC vape: witte achtergrond, scherpe details, lifestyle sfeer.",
    },
  },
  order_confirmation: {
    path: "/fumero/chat",
    params: {
      q: "Schrijf een bestelbevestiging: warme bedankmail direct na aankoop op fumero.nl, kort en persoonlijk.",
    },
  },
  campaign_banner: {
    path: "/fumero/chat",
    params: {
      q: "Maak een sale banner concept voor fumero.nl: heldere headline, actieperiode en sterke CTA.",
    },
  },
  review_flow: {
    path: "/fumero/automations",
    params: {},
  },
  social_posts: {
    path: "/fumero/chat",
    params: {
      q: "Maak 1 Instagram post voor fumero.nl: hook, caption en 5 relevante hashtags.",
    },
  },
  abandoned_cart: {
    path: "/fumero/automations",
    params: {},
  },
};

const TYPE_PILL_TARGETS: Record<
  FumeroTypePillId,
  { path: string; buildParams: (userPrompt: string) => Record<string, string> }
> = {
  email: {
    path: "/fumero/chat",
    buildParams: (p) => ({
      q: p || "Schrijf een transactionele e-mail voor fumero.nl klanten.",
    }),
  },
  photo: {
    path: "/fumero/chat",
    buildParams: (p) => ({
      q:
        p ||
        "Premium productfoto voor webshop: scherp product, witte achtergrond, subtiele schaduw.",
    }),
  },
  banner: {
    path: "/fumero/chat",
    buildParams: (p) => ({
      q: p || "Webshop banner met seizoensactie, headline en CTA.",
    }),
  },
  social: {
    path: "/fumero/chat",
    buildParams: (p) => ({
      q: p || "Instagram post voor fumero.nl met sterke hook en hashtags.",
    }),
  },
  text: {
    path: "/fumero/chat",
    buildParams: (p) => ({
      q: p || "Schrijf een overtuigende productbeschrijving voor de webshop.",
    }),
  },
  flow: {
    path: "/fumero/automations",
    buildParams: () => ({}),
  },
};

export function fumeroStudioUrl(
  path: string,
  params: Record<string, string | undefined>
): string {
  return buildStudioUrl(path, params);
}

export function fumeroChatWorkspaceUrl(prompt: string): string {
  return studioChatUrl("/fumero", prompt);
}

export function fumeroQuickActionUrl(id: FumeroQuickActionId): string {
  const def = QUICK_ACTION_DEFAULTS[id];
  return fumeroStudioUrl(def.path, def.params);
}

export function fumeroTypePillUrl(
  pillId: FumeroTypePillId,
  userPrompt: string
): string {
  const target = TYPE_PILL_TARGETS[pillId];
  const params = target.buildParams(userPrompt.trim());
  if (pillId === "text" && !userPrompt.trim()) {
    return fumeroChatWorkspaceUrl(
      "Help me met productteksten en webshop copy voor fumero.nl."
    );
  }
  return fumeroStudioUrl(target.path, params);
}

export function isFumeroContentType(v: string): v is FumeroStudioContentType {
  return (
    v === "product_photo" ||
    v === "banner" ||
    v === "social_post" ||
    v === "social_video" ||
    v === "product_text" ||
    v === "email_template" ||
    v === "seo_article"
  );
}
