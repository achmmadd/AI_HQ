"use client";

import { useEffect } from "react";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { applyWorkspaceToDocument } from "@/lib/workspace-themes";
import { applyFumeroThemeToDocument } from "@/lib/fumero/theme";
import "@/styles/fumero-ops.css";

export function FumeroWorkspaceRoot({ children }: { children: React.ReactNode }) {
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);

  useEffect(() => {
    setWorkspace("fumero");
    const root = document.documentElement;
    root.classList.add("fumero-ops");
    root.classList.remove("fumero-studio", "dark");
    root.setAttribute("data-fumero-ops", "");
    applyWorkspaceToDocument("fumero");
    applyFumeroThemeToDocument("light");

    return () => {
      root.classList.remove("fumero-ops", "light");
      root.removeAttribute("data-fumero-ops");
      root.removeAttribute("data-theme");
    };
  }, [setWorkspace]);

  return <div className="min-h-screen font-sans">{children}</div>;
}
