"use client";

import { useEffect } from "react";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useFumeroThemeStore } from "@/stores/useFumeroThemeStore";
import { applyWorkspaceToDocument } from "@/lib/workspace-themes";
import { applyFumeroThemeToDocument } from "@/lib/fumero/theme";
import "@/styles/fumero-ops.css";

export function FumeroWorkspaceRoot({ children }: { children: React.ReactNode }) {
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);
  const preference = useFumeroThemeStore((s) => s.preference);

  useEffect(() => {
    setWorkspace("fumero");
    const root = document.documentElement;
    root.classList.add("fumero-ops");
    root.classList.remove("fumero-studio");
    root.setAttribute("data-fumero-ops", "");
    applyWorkspaceToDocument("fumero");
    applyFumeroThemeToDocument(preference);

    return () => {
      root.classList.remove("fumero-ops");
      root.removeAttribute("data-fumero-ops");
      root.removeAttribute("data-theme");
    };
  }, [setWorkspace, preference]);

  useEffect(() => {
    applyFumeroThemeToDocument(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyFumeroThemeToDocument("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  return <div className="min-h-screen font-sans">{children}</div>;
}
