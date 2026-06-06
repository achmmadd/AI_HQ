export type ConnectorStatus = "active" | "available" | "coming_soon";

export type ConnectorScope = "fumero" | "motor_lab";

export type ConnectorCategory = "data" | "specialist";

export type ConnectorId =
  | "fumero_orders"
  | "fumero_bibliotheek"
  | "fumero_briefing"
  | "fumero_automations"
  | "online_research"
  | "designer"
  | "ux_review"
  | "templates"
  | "copywriter"
  | "seo"
  | "stripe"
  | "google_sheets"
  | "gmail"
  | "odoo"
  | "mollie";

export type ConnectorDefinition = {
  id: ConnectorId;
  name: string;
  description: string;
  iconKey: string;
  status: ConnectorStatus;
  scope: ConnectorScope;
  category?: ConnectorCategory;
  /** Standaard aan bij eerste bezoek (alleen active). */
  defaultEnabled?: boolean;
};

export const CONNECTORS_REGISTRY: ConnectorDefinition[] = [
  {
    id: "fumero_orders",
    name: "Orders",
    description: "Recente bestellingen en omzet uit Fumero",
    iconKey: "shopping-bag",
    status: "active",
    scope: "fumero",
    defaultEnabled: true,
  },
  {
    id: "fumero_bibliotheek",
    name: "Bibliotheek",
    description: "Contentbibliotheek — posts, drafts en planning",
    iconKey: "library",
    status: "active",
    scope: "fumero",
    defaultEnabled: true,
  },
  {
    id: "fumero_briefing",
    name: "Briefing",
    description: "Dagelijkse Max-briefing met acties en status",
    iconKey: "clipboard-list",
    status: "active",
    scope: "fumero",
    defaultEnabled: true,
  },
  {
    id: "fumero_automations",
    name: "Automations",
    description: "Geplande taken en recente runs",
    iconKey: "zap",
    status: "active",
    scope: "fumero",
    defaultEnabled: false,
  },
  {
    id: "online_research",
    name: "Online onderzoek",
    description: "Live webbronnen — gekoppeld aan Online-modus",
    iconKey: "globe",
    status: "active",
    scope: "fumero",
    defaultEnabled: false,
  },
  {
    id: "designer",
    name: "Webdesigner",
    description: "Fumero design system — kleuren, typografie en spacing bij bouwen",
    iconKey: "palette",
    status: "active",
    scope: "fumero",
    category: "specialist",
    defaultEnabled: true,
  },
  {
    id: "ux_review",
    name: "UX-tester",
    description: "Checklist: toegankelijkheid, contrast en mobiel — op verzoek",
    iconKey: "scan-eye",
    status: "active",
    scope: "fumero",
    category: "specialist",
    defaultEnabled: false,
  },
  {
    id: "templates",
    name: "Templates",
    description: "Tool-sjablonen (chat, rekenmachine, keuzehulp…) bij bouw-intent",
    iconKey: "layout-template",
    status: "active",
    scope: "fumero",
    category: "specialist",
    defaultEnabled: true,
  },
  {
    id: "copywriter",
    name: "Copywriter",
    description: "NL webshop-copy — binnenkort",
    iconKey: "pen-line",
    status: "coming_soon",
    scope: "fumero",
    category: "specialist",
  },
  {
    id: "seo",
    name: "SEO",
    description: "Meta, structuur en keywords — binnenkort",
    iconKey: "search",
    status: "coming_soon",
    scope: "fumero",
    category: "specialist",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Betalingen en omzet — binnenkort",
    iconKey: "credit-card",
    status: "coming_soon",
    scope: "fumero",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Spreadsheet sync — binnenkort",
    iconKey: "sheet",
    status: "coming_soon",
    scope: "fumero",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "E-mail & facturen — binnenkort",
    iconKey: "mail",
    status: "coming_soon",
    scope: "fumero",
  },
  {
    id: "odoo",
    name: "Odoo",
    description: "Boekhouding en ERP — OAuth via Nango (binnenkort)",
    iconKey: "database",
    status: "coming_soon",
    scope: "motor_lab",
  },
  {
    id: "mollie",
    name: "Mollie",
    description: "Betalingen — OAuth via Nango (binnenkort)",
    iconKey: "credit-card",
    status: "coming_soon",
    scope: "fumero",
  },
];

export function getConnectorById(id: ConnectorId): ConnectorDefinition | undefined {
  return CONNECTORS_REGISTRY.find((c) => c.id === id);
}

export function getFumeroConnectors(): ConnectorDefinition[] {
  return CONNECTORS_REGISTRY.filter((c) => c.scope === "fumero");
}

export function getFumeroDataConnectors(): ConnectorDefinition[] {
  return getFumeroConnectors().filter((c) => c.category !== "specialist");
}

export function getFumeroSpecialistConnectors(): ConnectorDefinition[] {
  return getFumeroConnectors().filter((c) => c.category === "specialist");
}

export function getDefaultEnabledConnectorIds(): ConnectorId[] {
  return CONNECTORS_REGISTRY.filter(
    (c) => c.status === "active" && c.defaultEnabled
  ).map((c) => c.id);
}

export function isConnectorToggleable(c: ConnectorDefinition): boolean {
  return c.status === "active" || c.status === "available";
}
