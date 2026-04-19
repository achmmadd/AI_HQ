import { create } from "zustand";
import type { CompanyId } from "@/lib/types";

type CompanyState = {
  company: CompanyId;
  setCompany: (c: CompanyId) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};

export const useCompanyStore = create<CompanyState>((set) => ({
  company: "fumero",
  setCompany: (company) => set({ company }),
  theme: "dark",
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));
