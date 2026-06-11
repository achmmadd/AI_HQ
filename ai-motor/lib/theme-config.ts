/** Central theme configuration for MotorsAI (next-themes). */
export const THEME_STORAGE_KEY = "motorsai-theme";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);var d=document.documentElement;var s=window.matchMedia("(prefers-color-scheme: dark)");var r=t==="dark"||(t!=="light"&&t!=="dark"&&s.matches);if(r){d.classList.add("dark");}else{d.classList.remove("dark");}d.style.colorScheme=r?"dark":"light";}catch(e){}})();`;
