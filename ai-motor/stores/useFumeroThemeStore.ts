import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  applyFumeroThemeToDocument,
  type FumeroThemePreference,
  writeStoredFumeroThemePreference,
} from "@/lib/fumero/theme";

type FumeroThemeState = {
  preference: FumeroThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: FumeroThemePreference) => void;
  cyclePreference: () => void;
};

export const useFumeroThemeStore = create<FumeroThemeState>()(
  persist(
    (set, get) => ({
      preference: "light",
      resolved: "light",
      setPreference: (preference) => {
        writeStoredFumeroThemePreference(preference);
        const resolved = applyFumeroThemeToDocument(preference);
        set({ preference, resolved });
      },
      cyclePreference: () => {
        const order: FumeroThemePreference[] = ["light", "dark", "system"];
        const idx = order.indexOf(get().preference);
        const next = order[(idx + 1) % order.length]!;
        get().setPreference(next);
      },
    }),
    {
      name: "fumero-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ preference: s.preference }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const resolved = applyFumeroThemeToDocument(state.preference);
        state.resolved = resolved;
      },
    }
  )
);
