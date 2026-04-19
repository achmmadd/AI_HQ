"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BuildResult {
  appName: string;
  description: string;
  features: string[];
  apiRoute: string;
  status: "done";
}

export default function BuilderPage() {
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState("");

  const handleBuild = async () => {
    if (!prompt.trim()) return;

    setBuilding(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          klant: "system",
          afdeling: "fabriek",
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as {
        appName?: string;
        description?: string;
        features?: string[];
        apiRoute?: string;
      };

      setResult({
        appName: data.appName || "New App",
        description: data.description || prompt,
        features: Array.isArray(data.features) ? data.features : [],
        apiRoute: data.apiRoute || "/api/custom-app",
        status: "done",
      });

      await fetch("/api/cursor-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `Build: ${prompt}`,
          section: "USER REQUESTS",
          priority: "hoog",
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build error");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <AppShell title="Live Builder">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Live Builder
          </h2>
          <p className="text-sm text-text-secondary">
            Typ je idee — Factory OS krijgt een bouwverzoek
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wat wil je bouwen?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Bijv: een reserveringssysteem voor restaurants met kalender"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={building}
              className="rounded-2xl"
            />
            <Button
              type="button"
              onClick={handleBuild}
              disabled={building || !prompt.trim()}
              className="w-full rounded-2xl"
            >
              {building ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aan het bouwen...
                </>
              ) : (
                "Bouw"
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-error/50 bg-error/10">
            <CardContent className="flex gap-3 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
              <p className="text-sm text-error">{error}</p>
            </CardContent>
          </Card>
        )}

        {building && (
          <Card className="border-blue-600/50 bg-blue-950/20">
            <CardContent className="p-4">
              <p className="text-sm text-blue-300">
                Factory OS verwerkt je prompt...
              </p>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{result.appName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-text-secondary">Beschrijving</p>
                <p className="mt-1 text-sm text-text-primary">
                  {result.description}
                </p>
              </div>
              {result.features.length > 0 && (
                <div>
                  <p className="text-sm text-text-secondary">Features</p>
                  <ul className="mt-1 space-y-1 text-sm text-text-primary">
                    {result.features.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-sm text-text-secondary">API-route</p>
                <code className="mt-1 block rounded-lg bg-surface-elevated p-2 text-xs text-text-primary">
                  {result.apiRoute}
                </code>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
