"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CustomAppRow {
  id: number;
  naam: string;
  slug: string;
  beschrijving: string | null;
  status: string;
  created_at: string;
}

interface BuildStep {
  label: string;
  done: boolean;
  active: boolean;
}

const DEMO_PROMPTS = [
  "Een todo app met donker thema",
  "Een timer met start/stop/reset knoppen",
  "Een rekenmachine",
  "Een dagplanner voor Bokas medewerkers",
  "Een kleurkiezer tool",
  "Een BMI calculator",
];

const BUILD_STEP_LABELS = [
  "Factory OS analyseert je verzoek…",
  "Agent genereert React-code…",
  "Code wordt gevalideerd…",
  "App wordt opgeslagen in SQLite…",
  "Live op /apps/[slug]…",
];

export default function BuilderPage() {
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [steps, setSteps] = useState<BuildStep[]>([]);
  const [result, setResult] = useState<{ url: string; naam: string } | null>(
    null
  );
  const [error, setError] = useState("");
  const [apps, setApps] = useState<CustomAppRow[]>([]);
  const [tab, setTab] = useState<"builder" | "apps">("builder");

  const fetchApps = useCallback(() => {
    fetch("/api/apps")
      .then((r) => r.json())
      .then((d: { apps?: CustomAppRow[] }) => setApps(d.apps ?? []))
      .catch(() => setApps([]));
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleBuild = async () => {
    if (!prompt.trim() || building) return;

    setBuilding(true);
    setError("");
    setResult(null);

    setSteps(
      BUILD_STEP_LABELS.map((label, i) => ({
        label,
        done: false,
        active: i === 0,
      }))
    );

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < BUILD_STEP_LABELS.length) {
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            done: i < stepIndex,
            active: i === stepIndex,
          }))
        );
      }
    }, 8000);

    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), klant: "system" }),
      });

      const data = (await res.json()) as {
        error?: string;
        url?: string;
        naam?: string;
      };

      if (!res.ok || data.error) {
        setError(data.error || "Build mislukt");
        setSteps([]);
        return;
      }

      setSteps(
        BUILD_STEP_LABELS.map((label) => ({
          label,
          done: true,
          active: false,
        }))
      );
      setResult({
        url: data.url || "",
        naam: data.naam || "App",
      });
      fetchApps();

      void fetch("/api/cursor-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `Builder: ${prompt.trim()}`,
          section: "USER REQUESTS",
          priority: "normaal",
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSteps([]);
    } finally {
      clearInterval(stepInterval);
      setBuilding(false);
    }
  };

  const deleteApp = async (slug: string) => {
    await fetch(`/api/apps/${slug}`, { method: "DELETE" });
    fetchApps();
  };

  return (
    <AppShell title="Live Builder">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Live Builder
            </h2>
            <p className="text-sm text-text-secondary">
              Genereer React + Tailwind in een sandbox; opslag in SQLite —
              geen nieuwe deploy nodig voor /apps/[slug].
            </p>
          </div>
          <div className="flex gap-2">
            {(["builder", "apps"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                variant={tab === t ? "default" : "secondary"}
                size="sm"
                className="rounded-xl"
                onClick={() => setTab(t)}
              >
                {t === "builder" ? "Builder" : `Mijn apps (${apps.length})`}
              </Button>
            ))}
          </div>
        </div>

        {tab === "builder" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DEMO_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                >
                  {p}
                </button>
              ))}
            </div>

            <Card>
              <CardContent className="space-y-3 p-4">
                <Textarea
                  placeholder="Beschrijf de app die je wilt bouwen…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  disabled={building}
                  className="resize-none rounded-2xl"
                />
                <Button
                  type="button"
                  onClick={() => void handleBuild()}
                  disabled={building || !prompt.trim()}
                  className="w-full rounded-2xl"
                  size="lg"
                >
                  {building ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Bezig met bouwen…
                    </>
                  ) : (
                    "Bouw app"
                  )}
                </Button>
              </CardContent>
            </Card>

            {steps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Voortgang</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                          step.done
                            ? "bg-green-600 text-white"
                            : step.active
                              ? "animate-pulse bg-accent text-white"
                              : "bg-surface-elevated text-text-secondary"
                        )}
                      >
                        {step.done ? "✓" : i + 1}
                      </div>
                      <span
                        className={cn(
                          "text-sm",
                          step.active
                            ? "text-text-primary"
                            : step.done
                              ? "text-text-secondary line-through"
                              : "text-text-secondary/60"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-error/50 bg-error/10">
                <CardContent className="p-4">
                  <p className="text-sm text-error">{error}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Factory OS probeert tot 3 keer. Details ook via Telegram.
                  </p>
                </CardContent>
              </Card>
            )}

            {result && (
              <Card className="border-green-600/40 bg-green-950/20">
                <CardContent className="space-y-3 p-4">
                  <p className="font-medium text-green-300">
                    {result.naam} is live
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2 rounded-xl"
                      onClick={() =>
                        window.open(
                          `${window.location.origin}${result.url}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      <Eye className="h-4 w-4" />
                      Bekijk app
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${window.location.origin}${result.url}`
                        )
                      }
                    >
                      Kopieer link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "apps" && (
          <div className="space-y-3">
            {apps.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-text-secondary">
                  <p>Nog geen apps.</p>
                  <p className="mt-1 text-sm">Start in het tabblad Builder.</p>
                </CardContent>
              </Card>
            ) : (
              apps.map((app) => (
                <Card key={app.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">
                        {app.naam}
                      </p>
                      {app.beschrijving && (
                        <p className="line-clamp-2 text-sm text-text-secondary">
                          {app.beschrijving}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-text-secondary">
                        {new Date(app.created_at).toLocaleString("nl-NL")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() =>
                          window.open(
                            `/apps/${app.slug}`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl text-error hover:text-error"
                        onClick={() => void deleteApp(app.slug)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
