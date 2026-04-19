"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Experiment = {
  id: number;
  name: string;
  hypothesis: string;
  variant_a: string;
  variant_b: string;
  status: string;
  klant: string | null;
  winner_variant: string | null;
  created_at: string;
  ends_at: string | null;
  closed_at: string | null;
  summary_json: string | null;
};

export default function AdminExperimentsPage() {
  const [rows, setRows] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [endsInDays, setEndsInDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/experiments", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { experiments?: Experiment[] };
      setRows(data.experiments ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createExperiment(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          hypothesis,
          variant_a: variantA,
          variant_b: variantB,
          ends_in_days: endsInDays,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setHypothesis("");
      setVariantA("");
      setVariantB("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Aanmaken mislukt");
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: number, action: "archive" | "finalize") {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/experiments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Actie mislukt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="A/B experimenten">
      <div className="mx-auto max-w-4xl space-y-8">
        <p className="text-sm text-text-secondary">
          Tijdens een <strong>actief</strong> experiment krijgt elke chat-turn
          willekeurig variant A of B (50/50). Antwoorden worden gelogd met{" "}
          <code className="rounded bg-surface-elevated px-1 text-xs">
            latency_ms
          </code>{" "}
          en gekoppeld aan 👍/👎. Wekelijks:{" "}
          <code className="rounded bg-surface-elevated px-1 text-xs">
            POST /api/cron/experiments/run
          </code>{" "}
          met cron-secret — sluit verlopen tests, past winnaar toe op
          instructies, Telegram.
        </p>

        {err && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}

        <form
          onSubmit={(e) => void createExperiment(e)}
          className="space-y-3 rounded-2xl border border-border bg-surface-elevated/40 p-4"
        >
          <h2 className="text-sm font-semibold">Nieuw experiment</h2>
          <p className="text-xs text-text-secondary">
            Start een nieuw actief experiment. Bestaande actieve worden
            gearchiveerd (geen automatische winnaar daarvan).
          </p>
          <Input
            placeholder="Naam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl"
            required
          />
          <Input
            placeholder="Hypothese (optioneel)"
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            className="rounded-xl"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <textarea
              placeholder="Variant A — instructie"
              value={variantA}
              onChange={(e) => setVariantA(e.target.value)}
              className="min-h-[100px] rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              required
            />
            <textarea
              placeholder="Variant B — alternatief"
              value={variantB}
              onChange={(e) => setVariantB(e.target.value)}
              className="min-h-[100px] rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Looptijd (dagen)
            <Input
              type="number"
              min={1}
              max={90}
              value={endsInDays}
              onChange={(e) =>
                setEndsInDays(Number(e.target.value) || 7)
              }
              className="h-8 w-20 rounded-lg"
            />
          </label>
          <Button
            type="submit"
            className="rounded-xl"
            disabled={creating}
          >
            {creating ? "Bezig…" : "Start experiment"}
          </Button>
        </form>

        <div>
          <h2 className="mb-3 text-sm font-semibold">Geschiedenis</h2>
          {loading && (
            <p className="text-sm text-text-secondary">Laden…</p>
          )}
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p
                      className={cn(
                        "text-xs font-medium uppercase tracking-wide",
                        r.status === "active" && "text-accent",
                        r.status === "done" && "text-green-600",
                        r.status === "archived" && "text-text-secondary"
                      )}
                    >
                      {r.status}
                      {r.winner_variant
                        ? ` · winnaar ${r.winner_variant.toUpperCase()}`
                        : ""}
                    </p>
                    <h3 className="mt-0.5 font-medium">{r.name}</h3>
                    {r.hypothesis && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {r.hypothesis}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-text-secondary">
                      {r.ends_at ? `tot ${r.ends_at}` : "geen einddatum"} · id{" "}
                      {r.id}
                    </p>
                  </div>
                  {r.status === "active" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patch(r.id, "finalize")}
                      >
                        Afronden (winnaar)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        disabled={busyId === r.id}
                        onClick={() => void patch(r.id, "archive")}
                      >
                        Archiveren
                      </Button>
                    </div>
                  )}
                </div>
                {r.summary_json && (
                  <pre className="mt-2 max-h-32 overflow-auto text-[10px] text-text-secondary">
                    {r.summary_json}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
