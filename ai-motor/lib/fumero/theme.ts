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
export const FUMERO_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(FUMERO_THEME_STORAGE_KEY)};var p=localStorage.getItem(k);var t=p==="dark"||p==="light"?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.remove("light","dark");r.classList.add(t);}catch(e){}})();`;
