import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Code2,
  Globe,
  ImagePlus,
  LayoutTemplate,
  Plug,
  ScanEye,
} from "lucide-react";
import type { FumeroStudioContentType } from "@/lib/fumero-quick-actions";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";

/** Active tool/mode in the Fumero composer (+ menu → mode pill). */
export type FumeroComposerMode =
  | "default"
  | "foto"
  | "canvas"
  | "coder"
  | "online";

export const FUMERO_CANVAS_PLACEHOLDER =
  "Laten we samen schrijven — blog, SEO-artikel of lange tekst…";

export const FUMERO_COMPOSER_MODE_META: Record<
  Exclude<FumeroComposerMode, "default">,
  { label: string; icon: LucideIcon; placeholder: string }
> = {
  foto: {
    label: "Foto",
    icon: Camera,
    placeholder: "Beschrijf de productfoto of banner die je wilt maken…",
  },
  canvas: {
    label: "Schrijven",
    icon: LayoutTemplate,
    placeholder: FUMERO_CANVAS_PLACEHOLDER,
  },
  coder: {
    label: "Bouwen",
    icon: Code2,
    placeholder: "Beschrijf je tool of stel een snelle vraag…",
  },
  online: {
    label: "Online",
    icon: Globe,
    placeholder: "Zoek op het web naar ",
  },
};

export function menuItemIdToComposerMode(
  itemId: string
): FumeroComposerMode | undefined {
  if (itemId === "foto") return "foto";
  if (itemId === "canvas") return "canvas";
  if (itemId === "coder") return "coder";
  if (itemId === "online") return "online";
  return undefined;
}

export type FumeroComposerMenuAction =
  | {
      kind: "content";
      contentType: FumeroStudioContentType;
      platform: string;
      prompt: string;
    }
  | { kind: "coder"; prompt?: string }
  | { kind: "research" }
  | { kind: "connectors" }
  | { kind: "ux_review" }
  | { kind: "templates" }
  | { kind: "code_workspace" }
  | {
      kind: "canvas";
      contentType: "seo_article" | "product_text";
      platform: string;
      prompt: string;
    }
  | { kind: "upload" };

export type FumeroComposerMenuSection = {
  id: string;
  label: string;
  items: FumeroComposerMenuItem[];
};

export type FumeroComposerMenuItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  action: FumeroComposerMenuAction;
  disabled?: boolean;
};

/** + menu: uploads + tools (Foto, Canvas, Coder) + Online onderzoek. */
export const FUMERO_COMPOSER_MENU_SECTIONS: FumeroComposerMenuSection[] = [
  {
    id: "uploads",
    label: "Uploads",
    items: [
      {
        id: "upload",
        label: "Bestanden & screenshots",
        description: "Sleep of kies PDF, afbeelding, DOCX…",
        icon: ImagePlus,
        action: { kind: "upload" },
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      {
        id: "foto",
        label: "Afbeelding maken",
        description: "Productfoto of banner — open Studio",
        icon: Camera,
        action: {
          kind: "content",
          contentType: "product_photo",
          platform: "webshop",
          prompt:
            "Genereer een premium productfoto voor fumero.nl: scherp product, witte achtergrond, subtiele schaduw.",
        },
      },
      {
        id: "canvas",
        label: "Schrijven",
        description: "Blog, SEO of lange producttekst — document rechts",
        icon: LayoutTemplate,
        action: {
          kind: "canvas",
          contentType: "seo_article",
          platform: "blog",
          prompt:
            "Schrijf een SEO-blogartikel voor fumero.nl over onze HHC/CBD collectie: heldere structuur, H1/H2, meta en body.",
        },
      },
      {
        id: "coder",
        label: "Bouwen",
        description: "Tool, widget of webapp — opent Bouwen",
        icon: Code2,
        action: {
          kind: "coder",
          prompt: "Bouw ",
        },
      },
    ],
  },
  {
    id: "research",
    label: "Onderzoek",
    items: [
      {
        id: "online",
        label: "Online onderzoek",
        description: "Eenmalig live webbronnen — geen Turbo standaard",
        icon: Globe,
        action: { kind: "research" },
      },
    ],
  },
  {
    id: "data_sync",
    label: "Data & sync",
    items: [
      {
        id: "connectors",
        label: "Connectors",
        description: "Orders, bibliotheek, briefing — live data voor Max",
        icon: Plug,
        action: { kind: "connectors" },
      },
    ],
  },
  {
    id: "specialists",
    label: "Specialisten",
    items: [
      {
        id: "templates",
        label: "Sjablonen",
        description: "Chat widget, rekenmachine, keuzehulp — kies een startpunt",
        icon: LayoutTemplate,
        action: { kind: "templates" },
      },
      {
        id: "ux_review",
        label: "Laat UX checken",
        description: "Toegankelijkheid, contrast en mobiel — checklist + tips",
        icon: ScanEye,
        action: { kind: "ux_review" },
      },
      {
        id: "code_workspace",
        label: "Code workspace",
        description: "Bewerk tool-code in de volledige IDE",
        icon: Code2,
        action: { kind: "code_workspace" },
      },
    ],
  },
];

/** Flat list for backwards compatibility. */
export const FUMERO_COMPOSER_MENU_ITEMS: FumeroComposerMenuItem[] =
  FUMERO_COMPOSER_MENU_SECTIONS.flatMap((s) => s.items);

export const FUMERO_CODER_PREFILL = "Bouw ";

export const FUMERO_RESEARCH_PREFILL = "Zoek op het web naar ";

export function fumeroComposerPlaceholder(
  mode: FumeroComposerMode,
  opts?: { modelTier?: FumeroComposerModelTier }
): string {
  if (mode === "default") return "Stel je vraag aan Max…";
  if (mode === "coder" && opts?.modelTier === "flash") {
    return "Snelle vraag — shop, orders, tools…";
  }
  return FUMERO_COMPOSER_MODE_META[mode].placeholder;
}
