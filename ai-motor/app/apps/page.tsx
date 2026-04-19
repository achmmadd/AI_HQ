"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Hammer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AppRow = {
  id: number;
  naam: string;
  slug: string;
  status: string;
  created_at: string;
};

export default function AppsIndexPage() {
  const [apps, setApps] = useState<AppRow[]>([]);

  const load = useCallback(() => {
    fetch("/api/apps", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { apps?: AppRow[] }) => setApps(d.apps ?? []))
      .catch(() => setApps([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteApp = async (slug: string) => {
    await fetch(`/api/apps/${slug}`, {
      method: "DELETE",
      credentials: "include",
    });
    load();
  };

  return (
    <AppShell title="Mijn apps">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Opgeslagen web-apps
            </h2>
            <p className="text-sm text-text-secondary">
              Bouw nieuwe apps in chat met{" "}
              <Link
                href="/chat?mode=build"
                className="text-accent underline-offset-2 hover:underline"
              >
                /chat?mode=build
              </Link>
              .
            </p>
          </div>
          <Button asChild className="rounded-xl gap-2">
            <Link href="/chat?mode=build">
              <Hammer className="h-4 w-4" />
              Nieuwe app bouwen
            </Link>
          </Button>
        </div>

        {apps.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-text-secondary">
              <p>Nog geen apps.</p>
              <Button asChild className="mt-4 rounded-xl">
                <Link href="/chat?mode=build">Start in chat</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {apps.map((app) => (
              <Card key={app.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    {app.naam}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="rounded-xl" asChild>
                      <a
                        href={`/apps/${app.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-xl text-error"
                      onClick={() => void deleteApp(app.slug)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-text-secondary">
                    /apps/{app.slug} ·{" "}
                    {new Date(app.created_at).toLocaleString("nl-NL")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
