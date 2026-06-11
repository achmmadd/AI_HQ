import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  FileText,
  Headphones,
  LineChart,
  Megaphone,
  MessageSquare,
  Rocket,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type { WorkspaceId } from "@/lib/types";

export const ONBOARDING_STEPS = 6;

export type OnboardingGoalId =
  | "grow-revenue"
  | "automate-ops"
  | "customer-support"
  | "content-marketing"
  | "analytics"
  | "team-productivity";

export type BusinessTypeId =
  | "ecommerce"
  | "agency"
  | "saas"
  | "manufacturing"
  | "retail"
  | "professional-services";

export type FirstActionId =
  | "chat"
  | "knowledge"
  | "automation"
  | "invite";

export type GoalOption = {
  id: OnboardingGoalId;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type BusinessTypeOption = {
  id: BusinessTypeId;
  title: string;
  description: string;
  icon: LucideIcon;
  workspace: WorkspaceId;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  specialty: string;
  icon: LucideIcon;
};

export type FirstActionOption = {
  id: FirstActionId;
  title: string;
  description: string;
  icon: LucideIcon;
  href: (workspace: WorkspaceId) => string;
};

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "grow-revenue",
    title: "Omzet groeien",
    description: "Meer leads, betere conversie en slimmere sales.",
    icon: Rocket,
  },
  {
    id: "automate-ops",
    title: "Processen automatiseren",
    description: "Minder handwerk, meer focus op wat telt.",
    icon: Workflow,
  },
  {
    id: "customer-support",
    title: "Klantenservice verbeteren",
    description: "Snellere antwoorden en consistente kwaliteit.",
    icon: Headphones,
  },
  {
    id: "content-marketing",
    title: "Content & marketing",
    description: "Campagnes, copy en social in één flow.",
    icon: Megaphone,
  },
  {
    id: "analytics",
    title: "Inzichten & analytics",
    description: "Data omzetten in beslissingen.",
    icon: LineChart,
  },
  {
    id: "team-productivity",
    title: "Teamproductiviteit",
    description: "Iedereen sneller en slimmer laten werken.",
    icon: Users,
  },
];

export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = [
  {
    id: "ecommerce",
    title: "E-commerce",
    description: "Webshops, marketplaces en D2C merken.",
    icon: ShoppingBag,
    workspace: "bokas",
  },
  {
    id: "agency",
    title: "Agency / Studio",
    description: "Creatief, marketing of digitale diensten.",
    icon: Sparkles,
    workspace: "fumero",
  },
  {
    id: "saas",
    title: "SaaS / Tech",
    description: "Software, platforms en productteams.",
    icon: Bot,
    workspace: "personal",
  },
  {
    id: "manufacturing",
    title: "Productie & industrie",
    description: "Fabrieken, supply chain en operations.",
    icon: Settings2,
    workspace: "fumero",
  },
  {
    id: "retail",
    title: "Retail & horeca",
    description: "Winkels, ketens en lokale ondernemers.",
    icon: Store,
    workspace: "bokas",
  },
  {
    id: "professional-services",
    title: "Zakelijke diensten",
    description: "Consultancy, finance, legal en HR.",
    icon: FileText,
    workspace: "personal",
  },
];

export const GENERATION_CHECKLIST = [
  "Bedrijfsprofiel analyseren",
  "AI-agents configureren",
  "Kennisbank voorbereiden",
  "Workflows personaliseren",
  "Werkplek afronden",
] as const;

const TEAM_POOL: TeamMember[] = [
  {
    id: "strategist",
    name: "Nova",
    role: "Strategie-agent",
    specialty: "Groei & prioriteiten",
    icon: Rocket,
  },
  {
    id: "ops",
    name: "Atlas",
    role: "Operations-agent",
    specialty: "Automatisering & processen",
    icon: Workflow,
  },
  {
    id: "support",
    name: "Echo",
    role: "Support-agent",
    specialty: "Klantvragen & FAQ",
    icon: Headphones,
  },
  {
    id: "content",
    name: "Lyra",
    role: "Content-agent",
    specialty: "Copy, campagnes & social",
    icon: Megaphone,
  },
  {
    id: "analyst",
    name: "Sigma",
    role: "Data-agent",
    specialty: "Rapportages & inzichten",
    icon: BarChart3,
  },
  {
    id: "productivity",
    name: "Pulse",
    role: "Team-agent",
    specialty: "Taken, planning & samenwerking",
    icon: Users,
  },
];

const GOAL_TEAM_MAP: Record<OnboardingGoalId, string[]> = {
  "grow-revenue": ["strategist", "content", "analyst"],
  "automate-ops": ["ops", "strategist", "productivity"],
  "customer-support": ["support", "ops", "productivity"],
  "content-marketing": ["content", "strategist", "analyst"],
  analytics: ["analyst", "strategist", "ops"],
  "team-productivity": ["productivity", "ops", "support"],
};

export function getTeamForGoal(goal: OnboardingGoalId): TeamMember[] {
  const ids = GOAL_TEAM_MAP[goal] ?? GOAL_TEAM_MAP["team-productivity"];
  return ids
    .map((id) => TEAM_POOL.find((m) => m.id === id))
    .filter((m): m is TeamMember => m != null);
}

export const FIRST_ACTION_OPTIONS: FirstActionOption[] = [
  {
    id: "chat",
    title: "Start een gesprek",
    description: "Praat met je AI-team en krijg direct antwoord.",
    icon: MessageSquare,
    href: (ws) =>
      ws === "fumero"
        ? "/fumero/chat"
        : ws === "bokas"
          ? "/bokas/chat"
          : "/chat",
  },
  {
    id: "knowledge",
    title: "Kennis toevoegen",
    description: "Upload documenten zodat AI jouw bedrijf kent.",
    icon: FileText,
    href: () => "/settings/context",
  },
  {
    id: "automation",
    title: "Automatisering opzetten",
    description: "Bouw je eerste workflow of integratie.",
    icon: Zap,
    href: (ws) => (ws === "fumero" ? "/fumero/chat" : "/chat"),
  },
  {
    id: "invite",
    title: "Team uitnodigen",
    description: "Nodig collega's uit om samen te werken.",
    icon: Users,
    href: () => "/settings",
  },
];

/** Default post-onboarding destination (matches "Start een gesprek" first action). */
export function getDefaultOnboardingHref(workspace: WorkspaceId): string {
  const chat = FIRST_ACTION_OPTIONS.find((a) => a.id === "chat");
  return chat?.href(workspace) ?? "/chat";
}

export type AiUnderstandingPreview = {
  industry: string;
  focus: string;
  tone: string;
  priority: string;
};

export function buildAiUnderstandingPreview(
  description: string,
  businessType: BusinessTypeId | null,
  goal: OnboardingGoalId | null
): AiUnderstandingPreview {
  const biz = BUSINESS_TYPE_OPTIONS.find((b) => b.id === businessType);
  const goalOpt = GOAL_OPTIONS.find((g) => g.id === goal);
  const text = description.toLowerCase();

  let tone = "Professioneel en helder";
  if (text.includes("premium") || text.includes("luxe")) tone = "Premium en persoonlijk";
  if (text.includes("snel") || text.includes("direct")) tone = "Direct en praktisch";

  let priority = goalOpt?.title ?? "Teamproductiviteit";
  if (text.includes("klant") || text.includes("support")) priority = "Klantenservice verbeteren";
  if (text.includes("verkoop") || text.includes("omzet")) priority = "Omzet groeien";

  return {
    industry: biz?.title ?? "Zakelijk",
    focus: description.trim()
      ? description.trim().slice(0, 120) + (description.length > 120 ? "…" : "")
      : "Wacht op jouw beschrijving…",
    tone,
    priority,
  };
}
