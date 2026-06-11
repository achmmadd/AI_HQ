export const MAKER_PANEL_STORAGE_KEY = "fumero-studio-maker-width";
export const MAKER_PANEL_DEFAULT = 340;
export const MAKER_PANEL_MIN = 280;
export const MAKER_PANEL_MAX = 460;

export function clampMakerPanelWidth(value: number): number {
  return Math.min(MAKER_PANEL_MAX, Math.max(MAKER_PANEL_MIN, Math.round(value)));
}

export function readMakerPanelWidth(
  storage: Pick<Storage, "getItem"> | null = typeof window !== "undefined"
    ? window.localStorage
    : null
): number {
  if (!storage) return MAKER_PANEL_DEFAULT;
  const raw = storage.getItem(MAKER_PANEL_STORAGE_KEY);
  if (!raw) return MAKER_PANEL_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return MAKER_PANEL_DEFAULT;
  return clampMakerPanelWidth(parsed);
}

export function writeMakerPanelWidth(
  width: number,
  storage: Pick<Storage, "setItem"> | null = typeof window !== "undefined"
    ? window.localStorage
    : null
): number {
  const clamped = clampMakerPanelWidth(width);
  storage?.setItem(MAKER_PANEL_STORAGE_KEY, String(clamped));
  return clamped;
}
