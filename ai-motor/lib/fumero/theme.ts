/** Fumero Studio theme — separate from global MotorsAI theme. */

export type FumeroThemePreference = "light" | "dark" | "system";

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

export function readStoredFumeroThemePreference(): FumeroThemePreference {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(FUMERO_THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "light";
}

export function writeStoredFumeroThemePreference(
  preference: FumeroThemePreference
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FUMERO_THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
}

/** Apply resolved theme to html[data-fumero-ops]. Call before paint when possible. */
export function applyFumeroThemeToDocument(
  preference: FumeroThemePreference
): "light" | "dark" {
  const resolved = resolveFumeroTheme(preference);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  return resolved;
}

/** Inline bootstrap — prevents FOUC on Fumero routes. */
export const FUMERO_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var r=document.documentElement;r.setAttribute("data-theme","light");r.classList.remove("dark");r.classList.add("light");}catch(e){}})();`;
