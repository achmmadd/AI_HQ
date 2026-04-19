"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Review = {
  id: number;
  external_id: string | null;
  source: string;
  reviewer_name: string | null;
  rating: number | null;
  review_text: string;
  suggested_reply: string | null;
  status: string;
  created_at: string;
};

export default function FumeroReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = filter === "pending" ? "?status=pending" : "";
    const r = await fetch(`/api/reviews${q}`);
    const j = await r.json();
    setReviews(Array.isArray(j.reviews) ? j.reviews : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function draft(id: number) {
    setBusy(id);
    try {
      const r = await fetch(`/api/reviews/${id}/draft`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Draft mislukt");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: number, status: string) {
    setBusy(id);
    try {
      await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <AppShell title="Reviews · Fumero">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary max-w-2xl">
          Reviewresponder: genereer een conceptantwoord via n8n (
          <code className="text-xs">N8N_REVIEW_WEBHOOK</code> of factory
          webhook met <code className="text-xs">type: review_reply</code>).
          Plak zelf in Google Business — API-koppeling volgt.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={filter === "pending" ? "default" : "secondary"}
            className="rounded-xl"
            onClick={() => setFilter("pending")}
          >
            Openstaand
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "default" : "secondary"}
            className="rounded-xl"
            onClick={() => setFilter("all")}
          >
            Alles
          </Button>
        </div>

        {loading && <p className="text-sm text-text-secondary">Laden…</p>}

        <div className="space-y-3">
          {reviews.map((rev) => (
            <Card key={rev.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {rev.reviewer_name || "Anoniem"}
                  {rev.rating != null && (
                    <span className="text-sm font-normal text-text-secondary">
                      {rev.rating}★ · {rev.source}
                    </span>
                  )}
                  <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium">
                    {rev.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{rev.review_text}</p>
                {rev.suggested_reply ? (
                  <div className="rounded-xl border border-border bg-surface-elevated p-3">
                    <p className="text-xs font-medium text-text-secondary mb-1">
                      Concept
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {rev.suggested_reply}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() => void copy(rev.suggested_reply!)}
                      >
                        Kopiëren
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        disabled={busy === rev.id}
                        onClick={() => void setStatus(rev.id, "approved")}
                      >
                        Markeer akkoord
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        disabled={busy === rev.id}
                        onClick={() => void setStatus(rev.id, "skipped")}
                      >
                        Overslaan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={busy === rev.id}
                    onClick={() => void draft(rev.id)}
                  >
                    {busy === rev.id ? "Bezig…" : "Genereer concept"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && reviews.length === 0 && (
          <p className="text-sm text-text-secondary">
            Geen reviews. Ingest via{" "}
            <code className="text-xs">POST /api/reviews</code> (webhook /
            automation).
          </p>
        )}
      </div>
    </AppShell>
  );
}
