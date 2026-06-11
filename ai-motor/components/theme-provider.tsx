"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { THEME_STORAGE_KEY } from "@/lib/theme-config";
import { syncFumeroDataTheme } from "@/lib/fumero/theme";
import {
  registerFumeroThemeBridge,
  syncFumeroThemeStoreResolved,
  useFumeroThemeStore,
} from "@/stores/useFumeroThemeStore";
function ThemeSideEffects({ children }: { children: React.ReactNode }) {
  const workspace = useCompanyStore((s) => s.workspace);
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setWorkspace(workspace);
  }, [setWorkspace, workspace]);

  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      const legacyUi = localStorage.getItem("ai-motor-ui");
      if (legacyUi) {
        const parsed = JSON.parse(legacyUi) as { state?: { theme?: string } };
        const legacy = parsed.state?.theme;
        if (legacy === "light" || legacy === "dark") {
          setTheme(legacy);
          return;
        }
      }
      const fumeroLegacy = localStorage.getItem("fumero-theme");
      if (
        fumeroLegacy === "light" ||
        fumeroLegacy === "dark" ||
        fumeroLegacy === "system"
      ) {
        setTheme(fumeroLegacy);
      }
    } catch {
      /* ignore */
    }
  }, [setTheme]);

  useEffect(() => {
    registerFumeroThemeBridge((preference) => {
      setTheme(preference);
    });
  }, [setTheme]);

  useEffect(() => {
    if (theme) {
      useFumeroThemeStore.setState({
        preference: theme as "light" | "dark" | "system",
      });
      syncFumeroThemeStoreResolved(
        (resolvedTheme ?? theme) === "dark" ? "dark" : "light"
      );
    }
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") {
      syncFumeroDataTheme(resolvedTheme);
    }
  }, [resolvedTheme]);

  return <>{children}</>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange={false}
    >
      <ThemeSideEffects>{children}</ThemeSideEffects>
    </NextThemesProvider>
  );
}
