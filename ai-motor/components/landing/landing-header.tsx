"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { LANDING_NAV, MOTORSAI_BRAND } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--os-border)] bg-[var(--os-bg)]/80 backdrop-blur-xl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[#69C400] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Naar hoofdinhoud
      </a>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${MOTORSAI_BRAND.name} home`}>
          <Logo size="sm" elevate />
          <span className="text-xl font-bold tracking-tight text-white">
            {MOTORSAI_BRAND.name}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-8 lg:flex"
          aria-label="Hoofdnavigatie"
        >
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-white/5 hover:text-white"
            >
              Inloggen
            </Button>
          </Link>
          <Link href="/demo">
            <Button size="sm" className="gap-1.5 bg-[#69C400] text-white hover:bg-[#5db000]">
              Plan demo
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Menu sluiten" : "Menu openen"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          "border-t border-white/[0.06] bg-[#080c14]/95 px-6 py-4 lg:hidden",
          open ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-1" aria-label="Mobiele navigatie">
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white">
                Inloggen
              </Button>
            </Link>
            <Link href="/demo" onClick={() => setOpen(false)}>
              <Button className="w-full gap-2 bg-[#69C400] text-white hover:bg-[#5db000]">
                Plan demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
