"use client";
import { useEffect, useState } from "react";
import { Calendar, Check, X } from "lucide-react";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";
import type { CompanyId } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  item: ContentStudioGridItem | null;
  klant: CompanyId;
  onScheduled?: () => void;
};

export function PublishDialog({
  open,
  onClose,
  item,
  klant,
  onScheduled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    if (!open) {
      setDone(false);
      setError("");
      setConfirming(false);
      setScheduledAt("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !item) return null;

  const canPublish = Boolean(item.content_id && item.master_url);

  const schedule = async () => {
    if (!item.content_id) {
      setError("Dit item heeft nog geen content_id — genereer opnieuw of open in bibliotheek.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/photo-studio/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klant,
          content_id: item.content_id,
          datetime: scheduledAt.trim() || undefined,
          platform: "instagram",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        scheduled_at?: string;
      };
      if (!res.ok) throw new Error(data.error || "Inplannen mislukt");
      setScheduledAt(data.scheduled_at ?? "");
      setDone(true);
      onScheduled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inplannen mislukt");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="wc-glass w-full max-w-md rounded-2xl p-5 shadow-[var(--wc-shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="publish-title" className="text-[16px] font-semibold text-[var(--wc-text)]">
              Publiceren
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--wc-text-muted)]">
              Plan je creatie in op Instagram of exporteer via bibliotheek.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-[var(--wc-text-muted)] hover:bg-[var(--wc-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-accent)]"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--wc-accent-muted)] px-3 py-2 text-[13px] text-[var(--wc-text)]">
            <Check className="h-4 w-4 text-[var(--wc-accent)]" aria-hidden />
            Ingepland
            {scheduledAt ? `: ${new Date(scheduledAt).toLocaleString("nl-NL")}` : ""}
          </div>
        ) : confirming ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-[var(--wc-text)]">
              Je staat op het punt deze creatie extern in te plannen op Instagram.
              Controleer datum en tijd voordat je bevestigt.
            </p>
            {error ? (
              <p role="alert" className="text-[13px] text-[var(--fumero-danger-fg)]">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-[var(--wc-border)] px-3 py-2 text-[13px] font-medium"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Terug
              </button>
              <button
                type="button"
                className="wc-btn-primary flex-1"
                disabled={busy}
                onClick={() => void schedule()}
              >
                {busy ? "Bezig…" : "Bevestigen en inplannen"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="mb-3 block text-[12px] font-medium text-[var(--wc-text)]">
              Datum &amp; tijd (optioneel)
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={!canPublish}
                className="mt-1 w-full rounded-lg border border-[var(--wc-border)] bg-[var(--fumero-surface)] px-3 py-2 text-[14px] text-[var(--wc-text)] placeholder:text-[var(--wc-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-accent)] disabled:opacity-50"
              />
            </label>
            <p className="mb-4 text-[11px] text-[var(--wc-text-muted)]">
              Leeg = morgen 10:00 via schedule API
            </p>
            {error ? (
              <p role="alert" className="mb-3 text-[13px] text-[var(--fumero-danger-fg)]">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="wc-btn-primary flex-1 disabled:opacity-50"
                disabled={busy || !canPublish}
                onClick={() => setConfirming(true)}
              >
                <Calendar className="h-4 w-4" aria-hidden />
                Inplannen…
              </button>
              <a
                href="/fumero/bibliotheek"
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-[var(--wc-border)] px-3 text-[13px] font-medium text-[var(--wc-text)] hover:bg-[var(--wc-surface-muted)]"
              >
                Bibliotheek
              </a>
            </div>
            {!canPublish ? (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                Publiceren vereist een opgeslagen creatie met afbeelding en content_id.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
