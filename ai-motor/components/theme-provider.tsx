"use client";

import { useEffect } from "react";
import { useCompanyStore } from "@/stores/useCompanyStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useCompanyStore((s) => s.theme);
  const workspace = useCompanyStore((s) => s.workspace);
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);

  useEffect(() => {
    setWorkspace(workspace);
  }, [setWorkspace, workspace]);

  useEffect(() => {
    if (workspace === "fumero") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme, workspace]);

  return <>{children}</>;
}
