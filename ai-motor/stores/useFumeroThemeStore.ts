import { create } from "zustand";
import type { FumeroThemePreference } from "@/lib/fumero/theme";

/**
 * Bridge for Fumero UI that still calls useFumeroThemeStore.
 * Theme persistence lives in next-themes (motorsai-theme).
 */
type FumeroThemeState = {
  preference: FumeroThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: FumeroThemePreference) => void;
  cyclePreference: () => void;
};

let externalSetTheme: ((theme: FumeroThemePreference) => void) | null = null;

export function registerFumeroThemeBridge(
  setTheme: (theme: FumeroThemePreference) => void
) {
  externalSetTheme = setTheme;
}

export function syncFumeroThemeStoreResolved(resolved: "light" | "dark") {
  useFumeroThemeStore.setState({ resolved });
}

export const useFumeroThemeStore = create<FumeroThemeState>()((set, get) => ({
  preference: "system",
  resolved: "light",
  setPreference: (preference) => {
    externalSetTheme?.(preference);
    set({ preference });
  },
  cyclePreference: () => {
    const order: FumeroThemePreference[] = ["light", "dark", "system"];
    const idx = order.indexOf(get().preference);
    const next = order[(idx + 1) % order.length]!;
    get().setPreference(next);
  },
}));
