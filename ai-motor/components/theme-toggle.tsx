"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme-config";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Licht", icon: Sun },
  { value: "dark", label: "Donker", icon: Moon },
  { value: "system", label: "Systeem", icon: Monitor },
];

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-[108px] rounded-[11px] border border-border/60 bg-muted/50",
          compact && "h-8 w-8",
          className
        )}
        aria-hidden
      />
    );
  }

  const active = (theme ?? "system") as ThemePreference;

  if (compact) {
    const next: ThemePreference =
      active === "light" ? "dark" : active === "dark" ? "system" : "light";
    const Icon =
      resolvedTheme === "dark"
        ? Moon
        : active === "system"
          ? Monitor
          : Sun;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-foreground shadow-sm transition-colors hover:bg-muted",
          className
        )}
        aria-label={`Thema: ${active}. Tik om te wisselen.`}
        title={`Thema: ${active}`}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex rounded-[11px] border border-border/60 bg-card/80 p-[3px] shadow-sm backdrop-blur-sm",
        className
      )}
      role="group"
      aria-label="Thema"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={active === value}
          className={cn(
            "inline-flex min-h-[30px] items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-medium transition-colors",
            active === value
              ? "bg-muted text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
