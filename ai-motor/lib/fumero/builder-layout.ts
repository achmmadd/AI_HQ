/**
 * Versioned key (v2): de oude ongeversioneerde key kon een ~50% breedte
 * bevatten die de nieuwe 28/72 default saboteerde. Oude key wordt genegeerd
 * en opgeruimd bij de eerstvolgende save.
 */
export const BUILDER_LAYOUT_STORAGE_KEY = "fumero-builder-chat-width:v2";
export const BUILDER_LAYOUT_LEGACY_STORAGE_KEYS = [
  "fumero-builder-chat-width",
] as const;

export function readStoredBuilderChatPercent(
  storage: Pick<Storage, "getItem">,
  containerWidth: number,
): number {
  try {
    return normalizeStoredBuilderChatPercent(
      storage.getItem(BUILDER_LAYOUT_STORAGE_KEY),
      containerWidth,
    );
  } catch {
    return BUILDER_CHAT_DEFAULT_PERCENT;
  }
}

export function persistBuilderChatPercent(
  storage: Pick<Storage, "setItem" | "removeItem">,
  percent: number,
): void {
  try {
    storage.setItem(BUILDER_LAYOUT_STORAGE_KEY, String(Math.round(percent * 10) / 10));
    for (const key of BUILDER_LAYOUT_LEGACY_STORAGE_KEYS) {
      storage.removeItem(key);
    }
  } catch {
    /* storage unavailable (private mode) — niet fataal */
  }
}
/** Builder panel default — wide enough for premium empty home (prompt + templates). */
export const BUILDER_CHAT_DEFAULT_PERCENT = 42;
export const BUILDER_CHAT_MIN_PX = 280;
export const BUILDER_CHAT_MAX_PERCENT = 50;
export const BUILDER_KEYBOARD_STEP_PERCENT = 2;

export type BuilderPanelMode = "split" | "chat" | "preview";

export function clampBuilderChatPercent(
  value: number,
  containerWidth: number,
): number {
  if (!Number.isFinite(value)) return BUILDER_CHAT_DEFAULT_PERCENT;
  const minPercent =
    containerWidth > 0 ? (BUILDER_CHAT_MIN_PX / containerWidth) * 100 : 0;
  const lower = Math.min(BUILDER_CHAT_MAX_PERCENT, minPercent);
  const upper = BUILDER_CHAT_MAX_PERCENT;
  return Math.min(upper, Math.max(lower, value));
}

export function builderChatPercentFromPointer(
  clientX: number,
  containerLeft: number,
  containerWidth: number,
): number {
  if (containerWidth <= 0) return BUILDER_CHAT_DEFAULT_PERCENT;
  const raw = ((clientX - containerLeft) / containerWidth) * 100;
  return clampBuilderChatPercent(raw, containerWidth);
}

export function builderChatPercentFromKeyboard(
  current: number,
  key: string,
  containerWidth: number,
): number {
  if (key === "Home") {
    return BUILDER_CHAT_DEFAULT_PERCENT;
  }
  if (key === "End") {
    return BUILDER_CHAT_MAX_PERCENT;
  }
  if (key === "ArrowLeft") {
    return clampBuilderChatPercent(
      current - BUILDER_KEYBOARD_STEP_PERCENT,
      containerWidth,
    );
  }
  if (key === "ArrowRight") {
    return clampBuilderChatPercent(
      current + BUILDER_KEYBOARD_STEP_PERCENT,
      containerWidth,
    );
  }
  return current;
}

export function normalizeStoredBuilderChatPercent(
  stored: string | null,
  containerWidth: number,
): number {
  if (!stored) return BUILDER_CHAT_DEFAULT_PERCENT;
  return clampBuilderChatPercent(Number(stored), containerWidth);
}
