"use client";

import { useEffect } from "react"; /** Chromeless full-height shell for worldclass studio (no Fumero sidebar/topbar). */
export function StudioLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.title = "Studio · Fumero Studio";
  }, []);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--fumero-bg)]">
      {" "}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>{" "}
    </div>
  );
}
