import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CompanyId } from "@/lib/types";

type CompanyState = {
  company: CompanyId;
  setCompany: (c: CompanyId) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      company: "fumero",
      setCompany: (company) => set({ company }),
      theme: "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    {
      name: "ai-motor-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, company: s.company }),
    }
  )
);
