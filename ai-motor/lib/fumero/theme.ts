/** Fumero Studio — syncs with global next-themes via data-theme on html. */

export type FumeroThemePreference = "light" | "dark" | "system";

/** @deprecated Use motorsai-theme (next-themes). Kept for one-time migration reads. */
export const FUMERO_THEME_STORAGE_KEY = "fumero-theme";

export function resolveFumeroTheme(
  preference: FumeroThemePreference
): "light" | "dark" {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

/** Sets data-theme for Fumero scoped CSS — does not touch html.dark (next-themes owns that). */
export function syncFumeroDataTheme(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

/** @deprecated Use syncFumeroDataTheme after resolving via next-themes. */
export function applyFumeroThemeToDocument(
  preference: FumeroThemePreference
): "light" | "dark" {
  const resolved = resolveFumeroTheme(preference);
  syncFumeroDataTheme(resolved);
  return resolved;
}

/** @deprecated Fumero theme is controlled by global next-themes. */
export function readStoredFumeroThemePreference(): FumeroThemePreference {
  return "system";
}

/** @deprecated Fumero theme is controlled by global next-themes. */
export function writeStoredFumeroThemePreference(
  _preference: FumeroThemePreference
): void {
  /* no-op — unified under motorsai-theme */
}
