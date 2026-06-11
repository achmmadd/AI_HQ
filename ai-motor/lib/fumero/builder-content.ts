/** Premium builder onboarding content — /fumero/bouwen */

export type BuilderSuggestion = {
  emoji: string;
  label: string;
  prompt: string;
};

export type BuilderTemplate = {
  id: string;
  icon: string;
  title: string;
  description: string;
  prompt: string;
  /** CSS gradient for preview thumbnail */
  gradient: string;
};

export type BuilderStat = {
  value: string;
  label: string;
};

export const BUILDER_TRUST_INDICATORS = [
  "Direct online",
  "Responsive",
  "AI gegenereerd",
] as const;

export const BUILDER_PROMPT_PLACEHOLDER =
  "Beschrijf jouw idee...";

export const BUILDER_PROMPT_EXAMPLE =
  "Maak een webshop voor vape-producten met voorraadbeheer en klantenportaal.";

export const BUILDER_SUGGESTIONS: BuilderSuggestion[] = [
  {
    emoji: "🛒",
    label: "E-commerce winkel",
    prompt:
      "Bouw een e-commerce winkel met productcatalogus, winkelwagen en checkout",
  },
  {
    emoji: "📦",
    label: "Voorraadbeheer systeem",
    prompt:
      "Maak een voorraadbeheer systeem met producten, voorraadniveaus en bestellingen",
  },
  {
    emoji: "🤖",
    label: "AI chatbot",
    prompt: "Maak een AI chatbot voor klantvragen op mijn website",
  },
  {
    emoji: "📊",
    label: "Dashboard",
    prompt:
      "Bouw een dashboard met KPI-tegels, grafieken en een overzichtstabel",
  },
  {
    emoji: "👥",
    label: "CRM systeem",
    prompt:
      "Maak een CRM systeem met klantenbeheer, contacten en deal pipeline",
  },
  {
    emoji: "📅",
    label: "Boekingssysteem",
    prompt:
      "Bouw een boekingssysteem met kalender, beschikbaarheid en bevestigingen",
  },
  {
    emoji: "🎓",
    label: "Leerplatform",
    prompt:
      "Maak een leerplatform met cursussen, voortgang en certificaten",
  },
  {
    emoji: "💰",
    label: "Facturatie software",
    prompt:
      "Bouw facturatie software met facturen, klanten en betalingsstatus",
  },
];

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: "ecommerce",
    icon: "🛒",
    title: "E-commerce",
    description: "Webshop met catalogus, winkelwagen en checkout",
    prompt:
      "Bouw een premium e-commerce webshop met productgrid, filters en winkelwagen",
    gradient: "linear-gradient(135deg, #1a2a1a 0%, #2d4a2d 50%, #8BC34A22 100%)",
  },
  {
    id: "wholesale",
    icon: "📦",
    title: "Wholesale Portal",
    description: "B2B bestelportaal voor groothandel",
    prompt:
      "Bouw een wholesale portal met bulk bestellingen, prijslijsten en klantaccounts",
    gradient: "linear-gradient(135deg, #1a1f2e 0%, #2a3550 50%, #8BC34A18 100%)",
  },
  {
    id: "crm",
    icon: "👥",
    title: "CRM",
    description: "Klantenbeheer en sales pipeline",
    prompt:
      "Maak een CRM dashboard met klantenlijst, deals en activiteitenlog",
    gradient: "linear-gradient(135deg, #1f1a2e 0%, #352a50 50%, #8BC34A18 100%)",
  },
  {
    id: "support",
    icon: "🎧",
    title: "Support Desk",
    description: "Ticket systeem en klantenservice",
    prompt:
      "Bouw een support desk met tickets, status en kennisbank",
    gradient: "linear-gradient(135deg, #1a2e2e 0%, #2a4545 50%, #8BC34A18 100%)",
  },
  {
    id: "ai-assistant",
    icon: "🤖",
    title: "AI Assistant",
    description: "Intelligente chatbot voor je website",
    prompt:
      "Maak een AI assistent chatbot met FAQ, gespreksgeschiedenis en suggesties",
    gradient: "linear-gradient(135deg, #1a1f1a 0%, #2a352a 50%, #8BC34A22 100%)",
  },
  {
    id: "booking",
    icon: "📅",
    title: "Booking Platform",
    description: "Afspraken en reserveringen beheren",
    prompt:
      "Bouw een boekingsplatform met kalender, tijdslots en bevestigingen",
    gradient: "linear-gradient(135deg, #2e1a1a 0%, #452a2a 50%, #8BC34A18 100%)",
  },
  {
    id: "inventory",
    icon: "📋",
    title: "Inventory Management",
    description: "Voorraad en magazijnbeheer",
    prompt:
      "Maak een voorraadbeheer app met producten, locaties en bestelniveaus",
    gradient: "linear-gradient(135deg, #1a2520 0%, #2a4035 50%, #8BC34A18 100%)",
  },
  {
    id: "analytics",
    icon: "📊",
    title: "Analytics Dashboard",
    description: "Data visualisatie en rapportages",
    prompt:
      "Bouw een analytics dashboard met KPI's, grafieken en export",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #2a2a45 50%, #8BC34A22 100%)",
  },
];

/** Removed unverifiable marketing stats — use workspace data in UI instead. */
export const BUILDER_STATS: BuilderStat[] = [];

export const BUILDER_LOADING_MESSAGES = [
  "Projectstructuur genereren...",
  "Componenten bouwen...",
  "Preview renderen...",
  "Styling toepassen...",
  "Laatste details afronden...",
] as const;

export const BUILDER_PREVIEW_FEATURES = [
  "Desktop, tablet en mobiel",
  "Live preview",
  "Direct itereren",
] as const;
