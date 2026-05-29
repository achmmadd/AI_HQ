import type { WorkspaceId } from "@/lib/types";

export type PhotoStudioPreset = {
  id: string;
  label: string;
  style_hint: string;
  default_prompt: string;
  extra?: Record<string, string>;
};

const FUMERO_PRESETS: PhotoStudioPreset[] = [
  {
    id: "product_template",
    label: "Product template",
    style_hint:
      "premium e-commerce product on neutral studio, soft shadows, catalog ready",
    default_prompt: "Premium product op schone studio-achtergrond",
  },
  {
    id: "ecommerce_crop",
    label: "E-commerce crop",
    style_hint: "tight product framing, white margin safe zone, webshop thumbnail",
    default_prompt: "Product centraal, ruimte voor crop naar vierkant",
  },
  {
    id: "woocommerce_upload",
    label: "WooCommerce upload",
    style_hint: "WooCommerce-ready square product, no text, sRGB accurate",
    default_prompt: "Webshop productfoto geschikt voor WooCommerce gallery",
    extra: { hook: "woocommerce_media_prepare", status: "stub" },
  },
];

const BOKAS_PRESETS: PhotoStudioPreset[] = [
  {
    id: "food_template",
    label: "Food template",
    style_hint:
      "appetizing Dutch restaurant dish, natural window light, shallow depth of field",
    default_prompt: "Gerecht op bord, restaurant setting",
  },
  {
    id: "business_presentatie",
    label: "Business presentatie",
    style_hint:
      "professional venue presentation, team or interior, warm hospitality brand",
    default_prompt: "Bokas restaurant sfeerbeeld voor presentatie",
  },
];

export function photoStudioPresetsForWorkspace(
  workspace: WorkspaceId
): PhotoStudioPreset[] {
  if (workspace === "bokas") return BOKAS_PRESETS;
  return FUMERO_PRESETS;
}

export function resolvePhotoStudioDefaults(workspace: WorkspaceId): {
  presets: PhotoStudioPreset[];
  active_preset_id: string;
  style_hint: string;
  default_prompt: string;
} {
  const presets = photoStudioPresetsForWorkspace(workspace);
  const active = presets[0];
  return {
    presets,
    active_preset_id: active.id,
    style_hint: active.style_hint,
    default_prompt: active.default_prompt,
  };
}
