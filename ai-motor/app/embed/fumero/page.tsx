"use client";

import { useEffect } from "react";
import { MotorsChatPanel } from "@/components/motors-chat-panel";
import { useCompanyStore } from "@/stores/useCompanyStore";

export default function FumeroEmbedPage() {
  const setCompany = useCompanyStore((s) => s.setCompany);

  useEffect(() => {
    setCompany("fumero");
  }, [setCompany]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Fumero Studio</p>
        <p className="text-xs text-text-secondary">Stel je vraag — Smokey helpt je graag.</p>
      </header>
      <div className="min-h-0 flex-1 p-2">
        <MotorsChatPanel embedded />
      </div>
    </div>
  );
}
