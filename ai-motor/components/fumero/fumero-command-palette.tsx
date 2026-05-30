"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BookOpen,
  Camera,
  Grid3X3,
  MessageSquare,
  Moon,
  PanelLeft,
  Plug,
  Search,
  ShoppingBag,
  Sun,
  Workflow,
  Zap,
  FileText,
  Globe,
  Code2,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dispatchFumeroCmd,
  FUMERO_CMD_EVENTS,
} from "@/lib/fumero/command-palette";
import { FUMERO_RESEARCH_PREFILL } from "@/lib/fumero/composer-actions";
import { useFumeroThemeStore } from "@/stores/useFumeroThemeStore";
import { useLayoutStore } from "@/stores/useLayoutStore";
import { FumeroStudioOverviewModal } from "@/components/fumero/ops/fumero-studio-overview-modal";
import type { FumeroThemePreference } from "@/lib/fumero/theme";

type CmdAction = {
  id: string;
  group: string;
  label: string;
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
};

export function FumeroCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const preference = useFumeroThemeStore((s) => s.preference);
  const setPreference = useFumeroThemeStore((s) => s.setPreference);
  const toggleSidebar = useLayoutStore((s) => s.toggleFumeroSidebarCollapsed);

  const close = useCallback(() => setOpen(false), []);

  const run = useCallback(
    (fn: () => void) => {
      close();
      fn();
    },
    [close]
  );

  const setTheme = useCallback(
    (theme: FumeroThemePreference) => {
      setPreference(theme);
    },
    [setPreference]
  );

  const actions: CmdAction[] = useMemo(
    () => [
      {
        id: "nav-chat",
        group: "Navigatie",
        label: "Ga naar Max (chat)",
        keywords: "assistent max chat",
        icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/chat"),
      },
      {
        id: "nav-photo",
        group: "Navigatie",
        label: "Productfoto's",
        keywords: "foto photo studio",
        icon: <Camera className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/photo-studio"),
      },
      {
        id: "nav-library",
        group: "Navigatie",
        label: "Bibliotheek",
        icon: <BookOpen className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/bibliotheek"),
      },
      {
        id: "nav-orders",
        group: "Navigatie",
        label: "Bestellingen",
        icon: <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/orders"),
      },
      {
        id: "nav-apps",
        group: "Navigatie",
        label: "Mijn apps",
        keywords: "apps garage tools",
        icon: <Grid3X3 className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/apps"),
      },
      {
        id: "nav-automations",
        group: "Navigatie",
        label: "Automatisering",
        icon: <Workflow className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/automations"),
      },
      {
        id: "max-new",
        group: "Max",
        label: "Nieuwe vraag",
        keywords: "new chat gesprek",
        icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />,
        run: () => {
          router.push("/fumero/chat");
          dispatchFumeroCmd(FUMERO_CMD_EVENTS.newChat);
          dispatchFumeroCmd(FUMERO_CMD_EVENTS.focusComposer);
        },
      },
      {
        id: "max-coder",
        group: "Max",
        label: "Bouw een tool",
        keywords: "coder bouwen build",
        icon: <Code2 className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/fumero/chat?mode=coder"),
      },
      {
        id: "max-canvas",
        group: "Max",
        label: "Schrijf SEO-artikel",
        keywords: "schrijven canvas blog seo",
        icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
        run: () => {
          router.push("/fumero/chat");
          dispatchFumeroCmd(FUMERO_CMD_EVENTS.setComposerMode, {
            mode: "canvas",
            prompt:
              "Schrijf een SEO-blogartikel voor fumero.nl over onze HHC/CBD collectie: heldere structuur, H1/H2, meta en body.",
          });
        },
      },
      {
        id: "max-online",
        group: "Max",
        label: "Zoek op internet",
        keywords: "online research web zoeken",
        icon: <Globe className="h-4 w-4" strokeWidth={1.5} />,
        run: () => {
          router.push("/fumero/chat");
          dispatchFumeroCmd(FUMERO_CMD_EVENTS.setComposerMode, {
            mode: "online",
            prompt: FUMERO_RESEARCH_PREFILL,
          });
        },
      },
      {
        id: "data-connectors",
        group: "Data",
        label: "Live shopdata",
        keywords: "connectors data sync",
        icon: <Plug className="h-4 w-4" strokeWidth={1.5} />,
        run: () => {
          router.push("/fumero/chat");
          dispatchFumeroCmd(FUMERO_CMD_EVENTS.openConnectors);
        },
      },
      {
        id: "data-overview",
        group: "Data",
        label: "Studio overzicht",
        keywords: "kpi stats cijfers",
        icon: <BarChart3 className="h-4 w-4" strokeWidth={1.5} />,
        run: () => setOverviewOpen(true),
      },
      {
        id: "data-briefing",
        group: "Data",
        label: "Dagoverzicht",
        keywords: "briefing max overzicht",
        icon: <ClipboardList className="h-4 w-4" strokeWidth={1.5} />,
        run: () => {
          router.push("/fumero/chat");
          dispatchFumeroCmd(FUMERO_CMD_EVENTS.openBriefing);
        },
      },
      {
        id: "view-light",
        group: "Weergave",
        label: "Light mode",
        icon: <Sun className="h-4 w-4" strokeWidth={1.5} />,
        run: () => setTheme("light"),
      },
      {
        id: "view-dark",
        group: "Weergave",
        label: "Dark mode",
        icon: <Moon className="h-4 w-4" strokeWidth={1.5} />,
        run: () => setTheme("dark"),
      },
      {
        id: "view-system",
        group: "Weergave",
        label: "Systeemthema",
        keywords: "system auto theme",
        icon: <Sun className="h-4 w-4" strokeWidth={1.5} />,
        run: () => setTheme("system"),
      },
      {
        id: "view-sidebar",
        group: "Weergave",
        label: "Sidebar inklappen",
        icon: <PanelLeft className="h-4 w-4" strokeWidth={1.5} />,
        run: () => toggleSidebar(),
      },
      {
        id: "settings-speed",
        group: "Instellingen",
        label: "Snelheid antwoord wisselen",
        keywords: "snel standaard grondig model tier flash pro",
        icon: <Zap className="h-4 w-4" strokeWidth={1.5} />,
        run: () => dispatchFumeroCmd(FUMERO_CMD_EVENTS.cycleModelTier),
      },
    ],
    [router, setTheme, toggleSidebar]
  );

  const groups = useMemo(() => {
    const map = new Map<string, CmdAction[]>();
    for (const action of actions) {
      const list = map.get(action.group) ?? [];
      list.push(action);
      map.set(action.group, list);
    }
    return map;
  }, [actions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onOverview = () => setOverviewOpen(true);
    window.addEventListener(FUMERO_CMD_EVENTS.openStudioOverview, onOverview);
    return () =>
      window.removeEventListener(FUMERO_CMD_EVENTS.openStudioOverview, onOverview);
  }, []);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/40 px-4 pt-[min(20vh,120px)]"
          onClick={close}
        >
          <div
            className="fumero-cmdk w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Fumero command palette" shouldFilter>
              <div className="flex items-center gap-2 border-b border-[var(--fumero-border)] px-3">
                <Search
                  className="h-4 w-4 shrink-0 text-[var(--fumero-text-subtle)]"
                  strokeWidth={1.5}
                />
                <Command.Input placeholder="Zoek actie…" autoFocus />
              </div>
              <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
                  Geen resultaten
                </Command.Empty>
                {[...groups.entries()].map(([group, items]) => (
                  <Command.Group key={group} heading={group}>
                    {items.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.keywords ?? ""}`}
                        onSelect={() => run(item.run)}
                        className="flex items-center gap-2.5 rounded-md"
                      >
                        <span className="text-[var(--fumero-text-muted)]">
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.id.startsWith("view-") &&
                        (item.id === "view-light"
                          ? preference === "light"
                          : item.id === "view-dark"
                            ? preference === "dark"
                            : item.id === "view-system"
                              ? preference === "system"
                              : false) ? (
                          <span className="fumero-text-micro text-[var(--fumero-accent)]">
                            actief
                          </span>
                        ) : null}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
              <div className="border-t border-[var(--fumero-border)] px-3 py-2 fumero-text-micro text-[var(--fumero-text-subtle)]">
                ↑↓ navigeren · Enter uitvoeren · Esc sluiten
              </div>
            </Command>
          </div>
        </div>
      ) : null}

      <FumeroStudioOverviewModal
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
      />
    </>
  );
}

/** Lazy wrapper — import in shell via dynamic(). */
export default FumeroCommandPalette;
