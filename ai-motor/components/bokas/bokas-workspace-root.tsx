"use client";

import { useEffect } from "react";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { applyWorkspaceToDocument, getWorkspaceTheme } from "@/lib/workspace-themes";
import "@/styles/bokas-studio.css";

function applyBokasStudioTokens() {
  const theme = getWorkspaceTheme("bokas");
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-d", theme.accentHover);
  root.style.setProperty("--accent-lt", theme.accentLt);
  root.style.setProperty("--accent-ring", "rgba(14, 165, 233, 0.15)");
  root.style.setProperty("--sans", theme.font);
}

export function BokasWorkspaceRoot({ children }: { children: React.ReactNode }) {
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);

  useEffect(() => {
    setWorkspace("bokas");
    const root = document.documentElement;
    root.classList.add("bokas-studio", "light");
    root.classList.remove("dark", "fumero-studio");
    applyWorkspaceToDocument("bokas");
    applyBokasStudioTokens();
    return () => {
      root.classList.remove("bokas-studio");
    };
  }, [setWorkspace]);

  return <div className="min-h-screen">{children}</div>;
}
