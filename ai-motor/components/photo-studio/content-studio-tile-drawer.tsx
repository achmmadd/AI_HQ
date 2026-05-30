"use client";

import { Calendar, Copy, Download, X } from "lucide-react";
import type { CompanyId } from "@/lib/types";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";

const VARIANT_LABELS: Record<string, string> = {
  ig_1_1: "Instagram 1:1",
  stories_9_16: "Stories 9:16",
  pinterest_2_3: "Pinterest 2:3",
  hero_16_9: "Hero 16:9",
};

type Props = {
  klant: CompanyId;
  item: ContentStudioGridItem | null;
  onClose: () => void;
  onScheduled?: () => void;
};

export function ContentStudioTileDrawer({
  klant,
  item,
  onClose,
  onScheduled,
}: Props) {
  if (!item) return null;

  const schedule = async () => {
    if (!item.content_id) return;
    const when = window.prompt(
      "Inplannen op (YYYY-MM-DD HH:MM, leeg = morgen 10:00):",
      ""
    );
    const res = await fetch("/api/photo-studio/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        klant,
        content_id: item.content_id,
        datetime: when?.trim() || undefined,
        platform: "instagram",
      }),
    });
    const data = (await res.json()) as { error?: string; scheduled_at?: string };
    if (!res.ok) {
      alert(data.error || "Inplannen mislukt");
      return;
    }
    alert(`Ingepland: ${data.scheduled_at ?? "ok"}`);
    onScheduled?.();
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(item.user_prompt);
    } catch {
      /* ignore */
    }
  };

  const formattedDate = item.created_at
    ? new Date(item.created_at).toLocaleString("nl-NL")
    : "—";

  return (
    <>
      <button
        type="button"
        className="content-studio-drawer-backdrop fixed inset-0 z-50 bg-black/40"
        aria-label="Sluiten"
        onClick={onClose}
      />
      <aside
        className="content-studio-drawer fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--fumero-border)] bg-[var(--fumero-surface)] shadow-[var(--fumero-shadow-md)]"
        role="dialog"
        aria-label="Beelddetails"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--fumero-border)] px-4 py-3">
          <h2 className="fumero-text-h3 text-[var(--fumero-text)]">Details</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={onClose}
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 overflow-hidden rounded-xl bg-[var(--fumero-surface-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.master_url}
              alt={item.user_prompt.slice(0, 80)}
              className="w-full object-contain"
            />
          </div>

          <dl className="mb-4 space-y-2">
            <div>
              <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                Prompt
              </dt>
              <dd className="fumero-text-body-sm mt-0.5 text-[var(--fumero-text)]">
                {item.user_prompt}
              </dd>
            </div>
            <div>
              <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                ID
              </dt>
              <dd className="fumero-text-body-sm mt-0.5 font-mono text-[var(--fumero-text-muted)]">
                {item.tracking_id}
              </dd>
            </div>
            <div>
              <dt className="fumero-text-caption text-[var(--fumero-text-muted)]">
                Aangemaakt
              </dt>
              <dd className="fumero-text-body-sm mt-0.5 text-[var(--fumero-text)]">
                {formattedDate}
              </dd>
            </div>
          </dl>

          {item.variants.length > 0 ? (
            <div className="mb-4">
              <h3 className="fumero-text-body-sm mb-2 font-medium text-[var(--fumero-text)]">
                Social formaten
              </h3>
              <ul className="space-y-2">
                {item.variants.map((v) => (
                  <li
                    key={v.public_url}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--fumero-border)] px-3 py-2"
                  >
                    <span className="fumero-text-body-sm text-[var(--fumero-text)]">
                      {VARIANT_LABELS[v.aspect] ?? v.aspect}
                      <span className="ml-1 text-[var(--fumero-text-muted)]">
                        {v.width}×{v.height}
                      </span>
                    </span>
                    <a
                      href={v.public_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--fumero-border)] px-2 fumero-text-caption text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--fumero-border)] p-4">
          <a
            href={item.master_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
          >
            <Download className="h-4 w-4" />
            Master
          </a>
          {item.content_id ? (
            <button
              type="button"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
              onClick={() => void schedule()}
            >
              <Calendar className="h-4 w-4" />
              Inplannen
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--fumero-border)] px-3 fumero-text-body-sm font-medium text-[var(--fumero-text)] hover:bg-[var(--fumero-surface-muted)]"
            onClick={() => void copyPrompt()}
          >
            <Copy className="h-4 w-4" />
          </button>
        </footer>
      </aside>
    </>
  );
}
