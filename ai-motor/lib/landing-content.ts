import { MOTORSAI as MOTORSAI_BRAND } from "@/lib/brand";

export { MOTORSAI as MOTORSAI_BRAND } from "@/lib/brand";
export { MOTORSAI, MOTORSAI_WORKSPACE_LABEL, WORKSPACE_LABELS } from "@/lib/brand";

export const LANDING_NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#oplossingen", label: "Oplossingen" },
  { href: "#use-cases", label: "Toepassingen" },
  { href: "#faq", label: "Veelgestelde vragen" },
] as const;

export const HERO = {
  eyebrow: "Enterprise AI voor het Nederlandse MKB",
  headline: "Automatiseer je bedrijfsprocessen met AI.",
  headlineAccent: "Op jouw eigen infrastructuur.",
  subheadline:
    "MotorsAI levert AI-agents voor sales, klantenservice, automatisering en kennisbeheer. Volledig on-premise, AVG-proof en operationeel binnen enkele dagen — zonder vendor lock-in.",
  primaryCta: "Plan een demo",
  secondaryCta: "Bekijk het platform",
  buildPromptPlaceholder: "Beschrijf wat je wilt bouwen…",
  buildPromptCta: "Start met bouwen",
  bullets: [
    "Live binnen enkele dagen, niet maanden",
    "Geen programmeerkennis vereist",
    "100% controle over je data en modellen",
  ],
} as const;

export const STATS = [
  { value: "100%", label: "Data-eigendom", detail: "Geen data naar externe clouds" },
  { value: "24/7", label: "AI-agents actief", detail: "Sales, support en operatie" },
  { value: "AVG", label: "Compliant by design", detail: "Privacy en auditability ingebouwd" },
  { value: "🇳🇱", label: "Nederlandse hosting", detail: "Lokale infrastructuur en support" },
] as const;

export const TRUST_ITEMS = [
  "On-premise of private cloud",
  "Open source stack",
  "Nederlandse implementatiepartner",
  "Geen vendor lock-in",
] as const;

export const FEATURES = [
  {
    id: "snel",
    title: "Snel operationeel",
    description:
      "Van intake tot live agents in dagen. Geen maandenlange implementatietrajecten of externe consultants.",
  },
  {
    id: "controle",
    title: "Volledige controle",
    description:
      "Draait op jouw server of private cloud. Jij bepaalt welke data, modellen en integraties worden gebruikt.",
  },
  {
    id: "continu",
    title: "Continu inzetbaar",
    description:
      "Agents werken 24/7 aan sales follow-up, support, rapportages en procesautomatisering — zonder extra FTE.",
  },
] as const;

export const USE_CASES = [
  {
    title: "Klantenservice & support",
    description:
      "Beantwoord veelgestelde vragen, routeer complexe cases en houd kennisbanken actueel — zonder wachtrijen.",
    metric: "−40% responstijd",
  },
  {
    title: "Sales & lead opvolging",
    description:
      "Qualificeer leads, stuur follow-ups en bereid gesprekken voor met actuele klantcontext.",
    metric: "+2× snellere opvolging",
  },
  {
    title: "Procesautomatisering",
    description:
      "Koppel CRM, e-mail, documenten en interne tools. Laat agents repetitieve taken overnemen.",
    metric: "8+ uur/week bespaard",
  },
  {
    title: "Interne kennisbank",
    description:
      "Doorzoek procedures, contracten en productinfo met AI — veilig binnen je eigen omgeving.",
    metric: "Direct antwoord op elke vraag",
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Intake & architectuur",
    description:
      "We brengen je processen, systemen en compliance-eisen in kaart. Geen generieke demo — een plan op maat.",
  },
  {
    step: "02",
    title: "Implementatie on-premise",
    description:
      "MotorsAI wordt geïnstalleerd op jouw infrastructuur. Integraties, agents en kennisbank worden ingericht.",
  },
  {
    step: "03",
    title: "Live & optimaliseren",
    description:
      "Je team werkt met AI-agents terwijl wij monitoren, finetunen en opschalen waar nodig.",
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "Eindelijk AI die we zelf hosten. Onze juridische afdeling was overtuigd zodra ze de dataflow zagen.",
    role: "Operations Manager",
    sector: "Logistiek · 80 FTE",
  },
  {
    quote:
      "Binnen twee weken draaiden onze support-agents. Geen cloud-risico, wel merkbaar minder tickets in de wachtrij.",
    role: "Head of Customer Success",
    sector: "B2B SaaS · 45 FTE",
  },
] as const;

export const FAQ = [
  {
    question: "Hoe lang duurt een implementatie?",
    answer:
      "Een standaardimplementatie duurt 2–4 weken, afhankelijk van integraties en scope. Een proof-of-concept kan vaak binnen enkele dagen live.",
  },
  {
    question: "Hebben we technische kennis nodig?",
    answer:
      "Nee. MotorsAI is gebouwd voor business teams. Technische inrichting doen wij; je team werkt via een intuïtieve interface.",
  },
  {
    question: "Waar draait MotorsAI?",
    answer:
      "Op jouw eigen server, private cloud of dedicated omgeving in Nederland. Data verlaat nooit je gecontroleerde infrastructuur.",
  },
  {
    question: "Is MotorsAI AVG-compliant?",
    answer:
      "Ja. On-premise architectuur, audit logs, rolgebaseerde toegang en verwerkersovereenkomsten zijn standaard onderdeel van elk traject.",
  },
  {
    question: "Wat kost MotorsAI?",
    answer:
      "Pricing is afhankelijk van scope, aantal agents en integraties. In een demo bespreken we je situatie en ontvang je een concreet voorstel.",
  },
  {
    question: "Integreert MotorsAI met onze bestaande tools?",
    answer:
      "Ja — CRM, e-mail, Slack, Microsoft 365, ERP en custom API's. We koppelen aan wat je al gebruikt.",
  },
  {
    question: "Wat als we al AI-tools gebruiken?",
    answer:
      "MotorsAI vervangt of vult aan, afhankelijk van je setup. We migreren kennisbanken en workflows waar dat zinvol is.",
  },
  {
    question: "Hoe snel zien we resultaat?",
    answer:
      "De meeste klanten zien binnen 30 dagen meetbare verbetering in responstijd, doorlooptijd of urenbesparing.",
  },
] as const;

export const FINAL_CTA = {
  headline: "Klaar om AI in te zetten zonder concessies?",
  subheadline:
    "Plan een vrijblijvende demo. We laten het platform zien op basis van jouw processen — geen generieke salespitch.",
  primaryCta: "Plan een demo",
  secondaryNote: "Gemiddelde responstijd: binnen 1 werkdag",
} as const;

export const FOOTER = {
  tagline: "MotorsAI — enterprise AI op jouw infrastructuur",
  links: [
    { href: "/demo", label: "Demo aanvragen" },
    { href: "/login", label: "Inloggen" },
    { href: "/privacy", label: "Privacyverklaring" },
    { href: `mailto:${MOTORSAI_BRAND.contactEmail}`, label: MOTORSAI_BRAND.contactEmail },
  ],
  badges: ["AVG-compliant", "On-premise", "Nederlandse support"],
} as const;

export const DEMO_FORM = {
  title: "Plan een demo",
  subtitle:
    "Vul je gegevens in. We nemen binnen één werkdag contact op om een demo in te plannen op basis van jouw situatie.",
  teamSizes: [
    { value: "1-10", label: "1–10 medewerkers" },
    { value: "11-50", label: "11–50 medewerkers" },
    { value: "51-200", label: "51–200 medewerkers" },
    { value: "200+", label: "200+ medewerkers" },
  ],
} as const;
