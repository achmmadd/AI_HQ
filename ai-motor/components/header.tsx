"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";
import type { CompanyId } from "@/lib/types";
import { cn } from "@/lib/utils";

const companies: { id: CompanyId; label: string }[] = [
  { id: "fumero", label: "Fumero" },
  { id: "bokas", label: "Bokas" },
];

export function Header({ title }: { title: string }) {
  const company = useCompanyStore((s) => s.company);
  const setCompany = useCompanyStore((s) => s.setCompany);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-xl">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl bg-surface-elevated p-1">
          {companies.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCompany(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                company === id
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <ThemeToggle compact />
      </div>
    </header>
  );
}
