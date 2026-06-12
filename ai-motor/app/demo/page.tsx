import type { Metadata } from "next";
import { DemoRequestForm } from "@/components/landing/demo-request-form";
import { LandingBackground } from "@/components/landing/shared";
import { DEMO_FORM, MOTORSAI_BRAND } from "@/lib/landing-content";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Demo aanvragen",
  description:
    "Plan een vrijblijvende demo van MotorsAI. Enterprise AI-automatisering on-premise voor het Nederlandse MKB.",
  openGraph: {
    title: `Plan een demo · ${MOTORSAI_BRAND.name}`,
    description:
      "Ontdek hoe MotorsAI AI-agents inzet voor sales, support en automatisering — op jouw eigen infrastructuur.",
  },
};

export default function DemoPage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[#080c14] text-white">
      <LandingBackground />

      <header className="relative z-10 border-b border-white/[0.06] px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Terug
          </Link>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" elevate decorative />
            <span className="font-semibold">{MOTORSAI_BRAND.name}</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {DEMO_FORM.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            {DEMO_FORM.subtitle}
          </p>
          <DemoRequestForm className="mt-8" />
        </div>
      </main>
    </div>
  );
}
