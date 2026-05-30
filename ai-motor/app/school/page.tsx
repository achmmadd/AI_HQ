"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, CheckCircle2, XCircle } from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  level: number;
  playbook: string;
  assignment: string;
};

type LogEntry = {
  date: string;
  lesson_id: string;
  pass: boolean;
  notes: string;
};

type SchoolData = {
  today: Lesson;
  curriculum: Lesson[];
  logbook: LogEntry[];
  learned_suffix: string;
  learned_updated_at: string | null;
};

export default function SchoolPage() {
  const [data, setData] = useState<SchoolData | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/school", {
      credentials: "include",
      cache: "no-store",
    });
    setData((await r.json()) as SchoolData);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logResult(pass: boolean) {
    if (!data) return;
    setSaving(true);
    try {
      await fetch("/api/school", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: data.today.id,
          pass,
          notes,
        }),
      });
      setNotes("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const today = data?.today;

  return (
    <AppShell title="Motor School">
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Dagelijkse training: eerlijkheid, echte CLI-output, geen mock doctor.{" "}
          <Link
            href="/chat"
            className="text-accent underline-offset-2 hover:underline"
          >
            Open chat
          </Link>{" "}
          om de les te doen.
        </p>

        <Card className="rounded-2xl border-accent/25 bg-gradient-to-br from-accent/8 to-surface">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-accent" />
              Les van vandaag
              {today ? (
                <span className="text-sm font-normal text-text-secondary">
                  {today.id} · niveau {today.level}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {today ? (
              <>
                <p className="font-medium">{today.title}</p>
                <p className="text-sm text-text-secondary">{today.assignment}</p>
                <p className="font-mono text-xs text-text-secondary">
                  docs/{today.playbook}
                </p>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Notities of geplakte terminal-output (optioneel)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={saving}
                    onClick={() => void logResult(true)}
                    className="gap-1"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Pass
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void logResult(false)}
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    Fail
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-text-secondary">Laden…</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Weekrooster</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(data?.curriculum ?? []).map((l) => (
                <li
                  key={l.id}
                  className={
                    l.id === today?.id
                      ? "font-medium text-accent"
                      : "text-text-secondary"
                  }
                >
                  {l.id} — {l.title} (niv. {l.level})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Logboek</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.logbook ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">Nog geen entries.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data!.logbook.map((e, i) => (
                  <li
                    key={`${e.date}-${e.lesson_id}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <span
                      className={e.pass ? "text-green-600" : "text-red-600"}
                    >
                      {e.pass ? "PASS" : "FAIL"}
                    </span>
                    <span className="font-mono text-xs">{e.date}</span>
                    <span>{e.lesson_id}</span>
                    {e.notes ? (
                      <span className="w-full text-text-secondary">
                        {e.notes}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {data?.learned_suffix ? (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Actieve learned suffix</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-text-secondary">
                {data.learned_suffix}
              </pre>
              {data.learned_updated_at ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Bijgewerkt: {data.learned_updated_at}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
