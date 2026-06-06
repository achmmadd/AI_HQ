"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/design-system/components";
import { AgentAvatar } from "@/components/AgentAvatar";
import { useCompanyStore, getWorkspaceTheme } from "@/stores/useCompanyStore";
import { useAuthSession } from "@/hooks/useAuthSession";
import { markOnboardingDone } from "@/lib/onboarding-storage";
import type { WorkspaceId } from "@/lib/types";
import { cn } from "@/lib/utils";

const START_ROUTE: Record<WorkspaceId, string> = {
  fumero: "/fumero/chat",
  bokas: "/bokas/chat",
  personal: "/chat",
};

type Step = "welcome" | "workspace" | "context" | "done";

const WORKSPACE_OPTIONS: {
  id: WorkspaceId;
  title: string;
  description: string;
  agent: string;
}[] = [
  {
    id: "fumero",
    title: "Fumero Studio",
    description: "Voor het Fumero-team: chat, apps bouwen en marketing.",
    agent: "Max helpt je team",
  },
  {
    id: "bokas",
    title: "Bokas",
    description: "Voor bonnen, voorraad en content van Bokas.",
    agent: "Bas helpt je team",
  },
  {
    id: "personal",
    title: "Motor AI",
    description: "Je persoonlijke lab: chat, code en goedkeuringen.",
    agent: "OpenClaw staat klaar",
  },
];

export function OnboardingWorkspaceFlow() {
  const router = useRouter();
  const { scope } = useAuthSession();
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);
  const [step, setStep] = useState<Step>("welcome");
  const [selected, setSelected] = useState<WorkspaceId>("fumero");
  const [contextText, setContextText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedWorkspaces = useMemo(() => {
    if (scope === "all") return WORKSPACE_OPTIONS;
    return WORKSPACE_OPTIONS.filter((w) => w.id === scope);
  }, [scope]);

  const activeWorkspace = allowedWorkspaces.some((w) => w.id === selected)
    ? selected
    : (allowedWorkspaces[0]?.id ?? "personal");

  async function saveContextAndFinish() {
    setSaving(true);
    setError(null);
    setWorkspace(activeWorkspace);

    const slug = activeWorkspace === "personal" ? "personal" : activeWorkspace;
    if (contextText.trim()) {
      try {
        const res = await fetch(`/api/workspaces/${slug}/context`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: contextText.trim() }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Teamcontext opslaan mislukt");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opslaan mislukt");
        setSaving(false);
        return;
      }
    }

    markOnboardingDone(activeWorkspace);
    setStep("done");
    setSaving(false);
  }

  function goToWorkspace() {
    router.push(START_ROUTE[activeWorkspace]);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-text-secondary">
          Stap{" "}
          {step === "welcome"
            ? "1"
            : step === "workspace"
              ? "2"
              : step === "context"
                ? "3"
                : "4"}{" "}
          van 4
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
          {step === "welcome" && "Welkom bij het team"}
          {step === "workspace" && "Kies je werkplek"}
          {step === "context" && "Vertel kort over je team"}
          {step === "done" && "Alles staat klaar"}
        </h1>
      </div>

      {step === "welcome" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
              Samen werken, zonder gedoe
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Motor AI helpt jullie team met chat, kennisbank en goedkeuringen.
              In een paar stappen kies je waar je wilt starten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              size="touch"
              className="w-full"
              onClick={() => setStep("workspace")}
            >
              Beginnen
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "workspace" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-text-secondary">
            Waar wil je vandaag mee aan de slag?
          </p>
          <ul className="space-y-3">
            {allowedWorkspaces.map((ws) => {
              const theme = getWorkspaceTheme(ws.id);
              const active = activeWorkspace === ws.id;
              return (
                <li key={ws.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(ws.id)}
                    className={cn(
                      "ios-tap-highlight flex w-full min-h-[var(--ds-touch-comfortable)] items-start gap-4 rounded-2xl border p-4 text-left transition-colors",
                      active
                        ? "border-accent bg-accent/10 ring-2 ring-accent/25"
                        : "border-border bg-surface hover:bg-surface-elevated"
                    )}
                  >
                    <AgentAvatar workspace={ws.id} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-text-primary">
                        {ws.title}
                      </span>
                      <span className="mt-1 block text-sm text-text-secondary">
                        {ws.description}
                      </span>
                      <span
                        className="mt-1 block text-xs font-medium"
                        style={{ color: theme.accent }}
                      >
                        {ws.agent}
                      </span>
                    </span>
                    {active ? (
                      <Check className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full sm:flex-1"
              onClick={() => setStep("welcome")}
            >
              Terug
            </Button>
            <Button
              type="button"
              size="touch"
              className="w-full sm:flex-1"
              onClick={() => setStep("context")}
            >
              Verder
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {step === "context" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Teamcontext (optioneel)</CardTitle>
            <CardDescription className="leading-relaxed">
              Schrijf in gewone taal wat jullie team doet. De AI gebruikt dit als
              achtergrond bij antwoorden. Je kunt dit later aanpassen in{" "}
              <a href="/settings/context" className="font-medium text-accent underline">
                instellingen
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm font-medium text-text-primary" htmlFor="onb-ctx">
              Over jullie team
            </label>
            <textarea
              id="onb-ctx"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              rows={5}
              placeholder="Bijv.: Wij verkopen premium producten in Nederland. Klanten bellen vaak over levering en retour."
              className="w-full min-h-[8rem] rounded-xl border border-border bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                size="touch"
                className="w-full sm:flex-1"
                onClick={() => setStep("workspace")}
                disabled={saving}
              >
                Terug
              </Button>
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="w-full sm:flex-1"
                onClick={() => void saveContextAndFinish()}
                disabled={saving}
              >
                Overslaan
              </Button>
              <Button
                type="button"
                size="touch"
                className="w-full sm:flex-1"
                disabled={saving || !contextText.trim()}
                onClick={() => void saveContextAndFinish()}
              >
                {saving ? "Opslaan…" : "Opslaan en verder"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {getWorkspaceTheme(activeWorkspace).name} is klaar
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Je team kan nu chatten, kennis toevoegen en taken goedkeuren. Veel
              succes vandaag!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" size="touch" className="w-full" onClick={goToWorkspace}>
              Naar {getWorkspaceTheme(activeWorkspace).name}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
