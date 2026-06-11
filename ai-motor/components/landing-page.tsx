"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Headphones,
  Play,
  Sparkles,
  TrendingUp,
  Zap,
  Lock,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FEATURES,
  FINAL_CTA,
  FAQ,
  HERO,
  HOW_IT_WORKS,
  STATS,
  TESTIMONIALS,
  TRUST_ITEMS,
  USE_CASES,
} from "@/lib/landing-content";
import { cn } from "@/lib/utils";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingBuildPrompt } from "@/components/landing/landing-build-prompt";
import {
  GlassCard,
  LandingBackground,
  ScrollReveal,
  SectionEyebrow,
  glassCardClass,
  outlineButtonClass,
  primaryButtonClass,
} from "@/components/landing/shared";

const FEATURE_ICONS = [Zap, Lock, Cpu] as const;
const FEATURE_ACCENTS = [
  {
    accent: "from-amber-500/20 to-orange-500/5",
    glow: "from-amber-500/15 to-transparent",
    shadow: "hover:shadow-amber-500/10",
    iconColor: "text-amber-400",
  },
  {
    accent: "from-blue-500/20 to-cyan-500/5",
    glow: "from-blue-500/15 to-transparent",
    shadow: "hover:shadow-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    accent: "from-emerald-500/20 to-green-500/5",
    glow: "from-emerald-500/15 to-transparent",
    shadow: "hover:shadow-emerald-500/10",
    iconColor: "text-emerald-400",
  },
] as const;

const AGENTS = [
  { icon: TrendingUp, name: "Sales Agent", status: "Actief" },
  { icon: Headphones, name: "Support Agent", status: "Actief" },
  { icon: Bot, name: "Operations Agent", status: "Actief" },
] as const;

function StatusDot({ pulse = false }: { pulse?: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {pulse ? (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      ) : null}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

function DashboardMockup() {
  return (
    <div
      id="dashboard-preview"
      className="relative w-full max-w-lg lg:max-w-none lg:justify-self-end"
      aria-label="Voorbeeld van het MotorsAI command center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-3xl bg-[var(--os-accent-glow)] blur-3xl"
      />
      <div className="os-glass relative overflow-hidden rounded-[var(--os-radius-xl)] shadow-[var(--os-shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-[var(--os-border)] px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="ml-2 text-xs font-medium tracking-wide text-[var(--os-text-muted)]">
            Command Center
          </span>
          <span className="ml-2 rounded-md border border-[var(--os-border)] bg-[var(--os-bg-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--os-text-subtle)]">
            Voorbeeld
          </span>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--os-border)] bg-[var(--os-bg-subtle)] px-2 py-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--os-text-muted)]">
              Demo
            </span>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Tokens vandaag", value: "12.4k", delta: "~€0.18" },
              { label: "Automations", value: "8", delta: "actief" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-[var(--os-radius-md)] border border-[var(--os-border)] bg-white/[0.02] p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-[var(--os-text-subtle)]">
                  {m.label}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--os-text)]">
                  {m.value}
                </p>
                <p className="text-[11px] text-[var(--os-accent)]">{m.delta}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--os-text-subtle)]">
              Actieve agents
            </p>
            {AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center gap-3 rounded-[var(--os-radius-md)] border border-[var(--os-border)] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--os-accent-muted)]">
                  <agent.icon className="h-4 w-4 text-[var(--os-accent)]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--os-text)]">{agent.name}</p>
                  <p className="text-xs text-[var(--os-text-muted)]">Eigen infrastructuur</p>
                </div>
                <StatusDot />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["Chat", "Bouwen", "Automations"].map((action) => (
              <div
                key={action}
                className="rounded-[var(--os-radius-sm)] border border-[var(--os-border)] bg-[var(--os-accent-muted)] px-2 py-2 text-center text-[11px] font-medium text-[var(--os-accent)]"
              >
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 open:bg-white/[0.04]">
      <summary className="cursor-pointer list-none text-base font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-4">
          {question}
          <span className="text-slate-500 transition-transform group-open:rotate-45">+</span>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{answer}</p>
    </details>
  );
}

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[var(--os-bg)] text-[var(--os-text)]">
      <LandingBackground />
      <LandingHeader />

      <main id="main-content" className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-16 lg:px-10 lg:pb-24 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <ScrollReveal>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#a3e635]/35 bg-[#69C400]/15 px-4 py-1.5 text-sm font-medium text-[#d9f99d]">
                  <Sparkles className="h-3.5 w-3.5 text-[#a3e635]" aria-hidden />
                  {HERO.eyebrow}
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.06}>
                <h1 className="max-w-xl text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-[var(--os-text)] sm:text-5xl lg:text-[3.5rem]">
                  {HERO.headline}{" "}
                  <span className="os-text-gradient">{HERO.headlineAccent}</span>
                </h1>
              </ScrollReveal>

              <ScrollReveal delay={0.12}>
                <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400 sm:text-xl">
                  {HERO.subheadline}
                </p>
              </ScrollReveal>

              <ScrollReveal delay={0.16}>
                <LandingBuildPrompt
                  className="mt-8"
                  placeholder={HERO.buildPromptPlaceholder}
                  buttonLabel={HERO.buildPromptCta}
                />
              </ScrollReveal>

              <ScrollReveal delay={0.18}>
                <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Link href="/demo" className="w-full sm:w-auto">
                    <Button size="lg" className={cn("w-full sm:w-auto", primaryButtonClass)}>
                      {HERO.primaryCta}
                      <ArrowRight className="h-5 w-5" aria-hidden />
                    </Button>
                  </Link>
                  <a href="#platform" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className={cn("w-full border-white/15 sm:w-auto", outlineButtonClass)}
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden />
                      {HERO.secondaryCta}
                    </Button>
                  </a>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.24}>
                <ul className="mt-6 flex flex-col gap-2.5 sm:items-start" aria-label="Belangrijkste voordelen">
                  {HERO.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-center gap-2.5 text-sm text-slate-400"
                    >
                      <Check className="h-4 w-4 shrink-0 text-[#69C400]" strokeWidth={2.5} aria-hidden />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
            </div>

            <ScrollReveal delay={0.1} className="w-full">
              <DashboardMockup />
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.28}>
            <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-[var(--os-border)] pt-10 text-center">
              {["Fumero Studio", "Bokas", "On-premise", "OpenClaw"].map((name) => (
                <span
                  key={name}
                  className="text-sm font-medium tracking-wide text-[var(--os-text-subtle)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </section>

        {/* Stats / Platform */}
        <section
          id="platform"
          className="scroll-mt-20 border-y border-white/[0.04] bg-white/[0.01] py-14 sm:py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
            <ScrollReveal>
              <div className="mb-10 text-center">
                <SectionEyebrow>Platform</SectionEyebrow>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Gebouwd voor vertrouwen, controle en schaal
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
                  Geen black-box AI. MotorsAI draait op infrastructuur die jij beheert — met
                  volledige transparantie over data, modellen en integraties.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {STATS.map((stat, i) => (
                <ScrollReveal key={stat.label} delay={i * 0.08}>
                  <GlassCard
                    glowClass={i === 0 ? "from-emerald-500/15 to-transparent" : undefined}
                    className={cn(glassCardClass, "p-6 sm:p-7")}
                  >
                    <p className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{stat.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
                  </GlassCard>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal>
              <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 backdrop-blur-sm sm:px-8 sm:py-5 lg:mt-10">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                  {TRUST_ITEMS.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 text-sm text-slate-400"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#69C400]/10">
                        <Check className="h-3 w-3 text-[#69C400]" strokeWidth={3} aria-hidden />
                      </span>
                      <span className="font-medium tracking-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Features */}
        <section
          id="oplossingen"
          className="scroll-mt-20 mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-28 lg:px-10"
        >
          <ScrollReveal>
            <div className="mb-12 text-center lg:mb-16">
              <SectionEyebrow>Oplossingen</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Waarom bedrijven kiezen voor MotorsAI
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
                Enterprise-grade AI zonder concessies aan privacy, compliance of operationele controle.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 lg:gap-5">
            {FEATURES.map((feature, i) => {
              const Icon = FEATURE_ICONS[i];
              const style = FEATURE_ACCENTS[i];
              return (
                <ScrollReveal
                  key={feature.id}
                  delay={i * 0.08}
                  className={cn(i === 0 && "lg:col-span-2 lg:row-span-2")}
                >
                  <GlassCard
                    glowClass={style.glow}
                    className={cn(
                      glassCardClass,
                      "h-full p-7 sm:p-8",
                      style.shadow,
                      i === 0 && "lg:min-h-[320px]"
                    )}
                  >
                    <div
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                        style.accent
                      )}
                    />
                    <div className="relative">
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                        <Icon className={cn("h-6 w-6", style.iconColor)} aria-hidden />
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                        {feature.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
                        {feature.description}
                      </p>
                    </div>
                  </GlassCard>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* Use cases */}
        <section
          id="use-cases"
          className="scroll-mt-20 border-y border-white/[0.04] bg-white/[0.01] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
            <ScrollReveal>
              <div className="mb-12 text-center">
                <SectionEyebrow>Toepassingen</SectionEyebrow>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Waar MotorsAI direct waarde levert
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid gap-5 sm:grid-cols-2">
              {USE_CASES.map((useCase, i) => (
                <ScrollReveal key={useCase.title} delay={i * 0.06}>
                  <article className={cn(glassCardClass, "h-full p-6 sm:p-8")}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#69C400]">
                      {useCase.metric}
                    </p>
                    <h3 className="mt-3 text-xl font-semibold text-white">{useCase.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">
                      {useCase.description}
                    </p>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-28 lg:px-10">
          <ScrollReveal>
            <div className="mb-12 text-center">
              <SectionEyebrow>Implementatie</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Van intake tot live in drie stappen
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid gap-6 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <ScrollReveal key={step.step} delay={i * 0.08}>
                <div className="relative h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
                  <span className="text-3xl font-bold tabular-nums text-[#69C400]/40">
                    {step.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Social proof */}
        <section className="border-y border-white/[0.04] bg-white/[0.01] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
            <ScrollReveal>
              <div className="mb-10 text-center">
                <SectionEyebrow>Ervaringen</SectionEyebrow>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Vertrouwd door operations- en IT-teams
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid gap-6 lg:grid-cols-2">
              {TESTIMONIALS.map((item, i) => (
                <ScrollReveal key={item.role} delay={i * 0.08}>
                  <blockquote className={cn(glassCardClass, "h-full p-6 sm:p-8")}>
                    <p className="text-base leading-relaxed text-slate-300">
                      &ldquo;{item.quote}&rdquo;
                    </p>
                    <footer className="mt-6 border-t border-white/[0.06] pt-4">
                      <p className="text-sm font-semibold text-white">{item.role}</p>
                      <p className="text-xs text-slate-500">{item.sector}</p>
                    </footer>
                  </blockquote>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 mx-auto max-w-3xl px-6 py-20 sm:px-8 sm:py-28 lg:px-10">
          <ScrollReveal>
            <div className="mb-10 text-center">
              <SectionEyebrow>Veelgestelde vragen</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Antwoord op je belangrijkste vragen
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-3">
            {FAQ.map((item) => (
              <ScrollReveal key={item.question}>
                <FaqItem question={item.question} answer={item.answer} />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20 sm:px-8 lg:px-10">
          <ScrollReveal>
            <div className="relative overflow-hidden rounded-3xl border border-[#69C400]/20 bg-gradient-to-br from-[#69C400]/10 via-white/[0.03] to-transparent px-6 py-12 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#69C400]/10 blur-3xl"
              />
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                {FINAL_CTA.headline}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
                {FINAL_CTA.subheadline}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href="/demo">
                  <Button size="lg" className={primaryButtonClass}>
                    {FINAL_CTA.primaryCta}
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-500">{FINAL_CTA.secondaryNote}</p>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <LandingFooter />

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#080c14]/95 p-3 backdrop-blur-xl sm:hidden">
        <Link href="/demo" className="block">
          <Button className="h-12 w-full gap-2 bg-[#69C400] text-base font-semibold text-white hover:bg-[#5db000]">
            Plan een demo
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    </div>
  );
}
