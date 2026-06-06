"use client";

import { usePathname } from "next/navigation";
import { MotorsSidebar } from "@/components/motors-sidebar";
import { MotorsHeader } from "@/components/motors-header";
import { cn } from "@/lib/utils";
import {
  NAV_WIDTH_COLLAPSED,
  NAV_WIDTH_EXPANDED,
  useLayoutStore,
} from "@/stores/useLayoutStore";

export function AppShell({
  title,
  children,
  /** Chat: vaste viewport-hoogte, geen pagina-scroll */
  flush = false,
}: {
  title: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  const pathname = usePathname();
  const navCollapsed = useLayoutStore((s) => s.navCollapsed);
  const navPad = navCollapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED;

  if (
    pathname === "/fumero" ||
    pathname?.startsWith("/fumero/") ||
    pathname === "/bokas" ||
    pathname?.startsWith("/bokas/")
  ) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "transition-[padding] duration-200 ease-out max-md:!pl-0",
        flush
          ? "h-[100dvh] overflow-hidden max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
          : "min-h-screen min-h-[100dvh] max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
      )}
      style={{ paddingLeft: navPad }}
    >
      <MotorsSidebar />
      <div
        className={cn(
          "flex flex-col",
          flush ? "h-full min-h-0 overflow-hidden" : "min-h-screen min-h-[100dvh]"
        )}
      >
        <MotorsHeader title={title} />
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            flush
              ? "px-0 py-0 pb-[env(safe-area-inset-bottom)]"
              : "px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-6"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
