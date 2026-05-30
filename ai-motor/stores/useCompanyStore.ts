import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatKlant, CompanyId, WorkspaceId } from "@/lib/types";
import {
  applyWorkspaceToDocument,
  getWorkspaceTheme,
  WORKSPACE_THEMES,
} from "@/lib/workspace-themes";

export { getWorkspaceTheme, WORKSPACE_THEMES };

type CompanyState = {
  company: CompanyId;
  workspace: WorkspaceId;
  setWorkspace: (ws: WorkspaceId) => void;
  setCompany: (c: CompanyId) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};

function companyForWorkspace(ws: WorkspaceId, current: CompanyId): CompanyId {
  if (ws === "personal") return current === "bokas" ? "bokas" : "fumero";
  return ws;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      company: "fumero",
      workspace: "fumero",
      setWorkspace: (workspace) => {
        const company = companyForWorkspace(workspace, get().company);
        applyWorkspaceToDocument(workspace);
        set({ workspace, company });
      },
      setCompany: (company) => {
        const workspace: WorkspaceId =
          company === "bokas" ? "bokas" : "fumero";
        applyWorkspaceToDocument(workspace);
        set({ company, workspace });
      },
      theme: "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    {
      name: "ai-motor-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        theme: s.theme,
        company: s.company,
        workspace: s.workspace,
      }),
    }
  )
);

/** API klant slug — personal lab gebruikt system. */
export function chatKlantForWorkspace(workspace: WorkspaceId): ChatKlant {
  if (workspace === "personal") return "system";
  return workspace;
}
