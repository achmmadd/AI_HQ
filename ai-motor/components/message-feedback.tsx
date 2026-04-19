"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompanyId } from "@/lib/types";

const REASONS = [
  { id: "too_long", label: "Tekst te lang" },
  { id: "wrong_answer", label: "Fout antwoord" },
  { id: "slow", label: "Slow response" },
] as const;

export function MessageFeedback({
  messageId,
  klant,
}: {
  messageId: number;
  klant: CompanyId;
}) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRating(rating: number, reason: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/message-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          rating,
          reason,
          klant,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onThumbsUp() {
    if (vote || busy) return;
    setVote("up");
    await submitRating(5, null);
  }

  function onThumbsDownClick() {
    if (vote || busy) return;
    setDialogOpen(true);
    setSelected(null);
    setOther("");
    setError(null);
  }

  async function onConfirmDown() {
    if (busy) return;
    let reason: string | null = null;
    if (selected === "other") {
      const t = other.trim();
      if (!t) {
        setError("Vul kort in wat er mis was.");
        return;
      }
      reason = `other: ${t.slice(0, 1500)}`;
    } else if (selected) {
      reason = selected;
    } else {
      setError("Kies een optie.");
      return;
    }
    setVote("down");
    setDialogOpen(false);
    await submitRating(1, reason);
  }

  if (vote) {
    return (
      <p className="mt-1.5 text-[11px] text-text-secondary">
        Bedankt voor je feedback.
      </p>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 rounded-lg px-2 text-xs text-text-secondary hover:text-text-primary"
        disabled={busy}
        onClick={() => void onThumbsUp()}
        title="Helpt dit antwoord?"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 rounded-lg px-2 text-xs text-text-secondary hover:text-text-primary"
        disabled={busy}
        onClick={onThumbsDownClick}
        title="Niet goed"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      {error && !dialogOpen && (
        <span className="text-[11px] text-error">{error}</span>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-down-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg">
            <h2
              id="feedback-down-title"
              className="text-sm font-semibold text-text-primary"
            >
              Wat was fout?
            </h2>
            <div className="mt-3 space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors",
                    selected === r.id
                      ? "border-accent bg-accent/10"
                      : "hover:bg-surface-elevated/80"
                  )}
                >
                  <input
                    type="radio"
                    name="fb-reason"
                    className="accent-accent"
                    checked={selected === r.id}
                    onChange={() => setSelected(r.id)}
                  />
                  {r.label}
                </label>
              ))}
              <label
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors",
                  selected === "other"
                    ? "border-accent bg-accent/10"
                    : "hover:bg-surface-elevated/80"
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="fb-reason"
                    className="accent-accent"
                    checked={selected === "other"}
                    onChange={() => setSelected("other")}
                  />
                  Anders
                </span>
                {selected === "other" && (
                  <textarea
                    className="min-h-[72px] w-full resize-y rounded-lg border border-border bg-surface-elevated px-2 py-1.5 text-xs"
                    placeholder="Kort toelichten…"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                  />
                )}
              </label>
            </div>
            {error && (
              <p className="mt-2 text-xs text-error">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl"
                disabled={busy}
                onClick={() => setDialogOpen(false)}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                disabled={busy}
                onClick={() => void onConfirmDown()}
              >
                Verstuur
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
