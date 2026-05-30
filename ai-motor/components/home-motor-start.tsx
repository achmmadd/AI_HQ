"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Sparkles,
  Terminal,
  BarChart3,
  Wrench,
  Mail,
  Globe,
  BookOpen,
  Moon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";
import type { CompanyId } from "@/lib/types";

type StartPayload = {
  brain_ok: boolean;
  dev_panel: boolean;
  brain: {
    openclaw: { configured: boolean; ok: boolean; error: string | null };
    executor: { configured: boolean; ok: boolean; error: string | null };
    openrouter: { configured: boolean };
  };
  memory: Record<string, { ok: boolean; host?: string }>;
  last_conversation: { id: number; title: string; updated_at: string } | null;
  usage_today: { tokens: number; eur: number };
  integrations: Array<{
    id: string;
    label: string;
    connected: boolean;
    hint: string;
  }>;
  autonomy_tasks: Array<{
    task_key: string;
    title: string;
    description: string;
    schedule: string;
  }>;
};

function Dot({ ok, muted }: { ok: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        muted
          ? "bg-text-secondary/30"
          : ok
            ? "bg-success"
            : "bg-error"
      )}
      aria-hidden
    />
  );
}

export function HomeMotorStart() {
  const company = useCompanyStore((s) => s.company);
  const [data, setData] = useState<StartPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (klant: CompanyId) => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/home/start?klant=${encodeURIComponent(klant)}`,
        { credentials: "include", cache: "no-store" }
      );
      setData((await r.json()) as StartPayload);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(company);
  }, [company, load]);

  const chatHref = data?.last_conversation
    ? `/chat?c=${data.last_conversation.id}`
    : "/chat";

  return (
    <div className="ios-fade-up space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/fumero/chat"
          className="rounded-2xl border border-[#69C400]/30 bg-[#69C400]/8 px-4 py-3 transition-colors hover:border-[#69C400]/50"
        >
          <p className="text-[13px] font-semibold text-text-primary">Fumero Studio</p>
          <p className="mt-1 text-[12px] text-text-secondary">Max · shop & content</p>
        </Link>
        <Link
          href="/bokas"
          className="rounded-2xl border border-sky-500/30 bg-sky-500/8 px-4 py-3 transition-colors hover:border-sky-500/50"
        >
          <p className="text-[13px] font-semibold text-text-primary">Bokas</p>
          <p className="mt-1 text-[12px] text-text-secondary">Bas · restaurant</p>
        </Link>
        <Link
          href="/chat"
          className="rounded-2xl border border-indigo-500/30 bg-indigo-500/8 px-4 py-3 transition-colors hover:border-indigo-500/50"
        >
          <p className="text-[13px] font-semibold text-text-primary">Motor Lab</p>
          <p className="mt-1 text-[12px] text-text-secondary">OpenClaw · bouwen & code</p>
        </Link>
      </div>

      <Card className="overflow-hidden rounded-2xl border-accent/25 bg-gradient-to-br from-accent/10 via-surface to-surface shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-[18px] font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-accent" />
            Motor Start
            <span className="text-[13px] font-normal text-text-secondary">
              — {company}
            </span>
            {!loading && data && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  data.brain_ok
                    ? "bg-success/15 text-success"
                    : "bg-error/15 text-error"
                )}
              >
                {data.brain_ok ? "Klaar om te bouwen" : "Check stack"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-[13px]">
            <span className="flex items-center gap-2">
              <Dot
                ok={!!data?.brain.openclaw.ok}
                muted={!data?.brain.openclaw.configured}
              />
              OpenClaw
            </span>
            <span className="flex items-center gap-2">
              <Dot
                ok={!!data?.brain.executor.ok}
                muted={!data?.brain.executor.configured}
              />
              NUC executor
            </span>
            <span className="flex items-center gap-2">
              <Dot ok={!!data?.brain.openrouter.configured} />
              OpenRouter
            </span>
          </div>

          {data?.last_conversation && (
            <p className="text-[13px] text-text-secondary">
              Laatste chat:{" "}
              <span className="font-medium text-text-primary">
                {data.last_conversation.title}
              </span>
            </p>
          )}

          {data && (
            <p className="text-[12px] text-text-secondary">
              Vandaag:{" "}
              <span className="tabular-nums text-text-primary">
                {data.usage_today.tokens.toLocaleString("nl-NL")} tokens
              </span>
              {data.usage_today.eur > 0 && (
                <> · ~€{data.usage_today.eur.toFixed(3)}</>
              )}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" asChild>
              <Link href={chatHref}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {data?.last_conversation ? "Verder in chat" : "Nieuwe chat"}
              </Link>
            </Button>
            <Button variant="secondary" className="rounded-xl" asChild>
              <Link href="/chat?plan=1">Plan-modus</Link>
            </Button>
            {data?.dev_panel && (
              <>
                <Button variant="secondary" className="rounded-xl" asChild>
                  <Link href="/dev">
                    <Terminal className="mr-2 h-4 w-4" />
                    Terminal
                  </Link>
                </Button>
                <Button variant="secondary" className="rounded-xl" asChild>
                  <Link href="/dev">
                    <Wrench className="mr-2 h-4 w-4" />
                    Dev
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Bedrijf & data
            </CardTitle>
            <p className="text-[12px] text-text-secondary">
              Gmail, site, kennis — Motor wordt autonomer per koppeling
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.integrations ?? []).map((i) => (
              <div
                key={i.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-surface-elevated/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px] font-medium">
                    {i.id === "gmail" && <Mail className="h-3.5 w-3.5" />}
                    {i.id === "website" && <Globe className="h-3.5 w-3.5" />}
                    {i.id === "kennisbank" && (
                      <BookOpen className="h-3.5 w-3.5" />
                    )}
                    {i.label}
                    <Dot ok={i.connected} />
                  </p>
                  <p className="text-[11px] text-text-secondary">{i.hint}</p>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" className="mt-1 rounded-xl" asChild>
              <Link href="/kennisbank">Kennisbank openen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Moon className="h-4 w-4 text-violet-400" />
              Dromen (autonomie)
            </CardTitle>
            <p className="text-[12px] text-text-secondary">
              Dagelijkse/wekelijkse opdrachten — zoals Anthropic “dreams”
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.autonomy_tasks ?? []).length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                Geen taken — zie Auto
              </p>
            ) : (
              data?.autonomy_tasks.slice(0, 5).map((t) => (
                <div
                  key={t.task_key}
                  className="rounded-xl border border-border/50 px-3 py-2 text-[13px]"
                >
                  <p className="font-medium">{t.title}</p>
                  <p className="text-[11px] text-text-secondary">
                    {t.schedule} · {t.description.slice(0, 80)}
                    {t.description.length > 80 ? "…" : ""}
                  </p>
                </div>
              ))
            )}
            <Button variant="secondary" size="sm" className="rounded-xl" asChild>
              <Link href="/cowork?tab=tasks">Alle taken</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Geheugen-stack
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {data &&
            Object.entries(data.memory).map(([name, dep]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-[13px]"
              >
                <span className="text-text-secondary">{name}</span>
                <Dot ok={!!dep.ok} />
              </div>
            ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" size="sm" className="rounded-xl" asChild>
          <Link href="/kosten/usage">
            <BarChart3 className="mr-2 h-3.5 w-3.5" />
            Usage
          </Link>
        </Button>
        <Button variant="secondary" size="sm" className="rounded-xl" asChild>
          <Link href="/dev">
            <Terminal className="mr-2 h-3.5 w-3.5" />
            Dev panel
          </Link>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-xl"
          onClick={() => void load(company)}
        >
          Vernieuwen
        </Button>
      </div>
    </div>
  );
}
