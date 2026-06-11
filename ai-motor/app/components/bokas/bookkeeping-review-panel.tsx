"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const BOKAS_CATEGORIES = [
  { value: "voedsel", label: "Voedsel (9%)" },
  { value: "drank", label: "Drank (21%)" },
  { value: "verpakking", label: "Verpakking" },
  { value: "huur", label: "Huur" },
  { value: "energie", label: "Energie / utilities" },
  { value: "personeel", label: "Personeel" },
  { value: "apparatuur", label: "Apparatuur / POS" },
  { value: "overig", label: "Overig" },
] as const;

export type ReviewForm = {
  filename: string;
  vendor: string;
  date: string;
  amount: string;
  btw_rate: string;
  category: string;
  location: string;
  payment_method: string;
  receipt_number: string;
  note: string;
};

export type ReviewDetail = {
  token?: string;
  path?: string;
  vendor?: string;
  date?: string;
  amount?: number | string;
  tax?: number | null;
  note?: string | null;
  type?: string;
  category?: string | null;
  location?: string | null;
  payment_method?: string | null;
  receipt_number?: string | null;
  filename?: string;
  suggested_filename?: string;
  btw_rates?: number[];
  date_correction?: string | null;
  ai_original?: Record<string, unknown> | null;
  edited_fields?: string[];
};

type Props = {
  open: boolean;
  mode: "pending" | "processed";
  detail: ReviewDetail | null;
  previewUrl: string | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (form: ReviewForm) => Promise<void>;
  onApprove?: (form: ReviewForm) => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
};

function formatDateInput(iso?: string) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return iso;
}

function detailToForm(d: ReviewDetail): ReviewForm {
  const amt = d.amount;
  const amountStr =
    typeof amt === "number" ? String(amt) : typeof amt === "string" ? amt : "";
  return {
    filename: d.filename ?? d.suggested_filename ?? "",
    vendor: d.vendor ?? "",
    date: formatDateInput(d.date),
    amount: amountStr,
    btw_rate: d.btw_rates?.[0] != null ? String(d.btw_rates[0]) : "9",
    category: d.category ?? "voedsel",
    location: d.location ?? "",
    payment_method: d.payment_method ?? "",
    receipt_number: d.receipt_number ?? "",
    note: d.note ?? "",
  };
}

function FieldLabel({
  label,
  aiValue,
  edited,
}: {
  label: string;
  aiValue?: string | null;
  edited?: boolean;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {edited ? (
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">jouw aanpassing</span>
      ) : aiValue ? (
        <span className="text-[10px] text-text-secondary">AI: {aiValue}</span>
      ) : null}
    </div>
  );
}

export function BookkeepingReviewPanel({
  open,
  mode,
  detail,
  previewUrl,
  busy,
  onClose,
  onSave,
  onApprove,
  onReject,
}: Props) {
  const [form, setForm] = useState<ReviewForm>(() => detailToForm(detail ?? {}));
  const [previewKind, setPreviewKind] = useState<"image" | "pdf">("image");

  useEffect(() => {
    if (detail) setForm(detailToForm(detail));
  }, [detail]);

  useEffect(() => {
    if (!previewUrl) return;
    void fetch(previewUrl, { method: "HEAD" }).then((r) => {
      const ct = r.headers.get("content-type") ?? "";
      setPreviewKind(ct.includes("pdf") ? "pdf" : "image");
    }).catch(() => setPreviewKind("image"));
  }, [previewUrl]);

  const ai = detail?.ai_original ?? {};
  const editedSet = useMemo(() => new Set(detail?.edited_fields ?? []), [detail?.edited_fields]);

  function aiStr(key: string): string | undefined {
    const v = ai[key];
    if (v == null) return undefined;
    return String(v);
  }

  function setField<K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (!open || !detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 p-2 sm:p-4">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl mx-auto">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {mode === "pending" ? "Bon controleren" : "Bon bewerken"}
            </h2>
            <p className="text-xs text-text-secondary">
              Controleer AI-voorstel, pas aan, sla op — keur pas daarna goed.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="rounded-xl" onClick={onClose}>
            Sluiten
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <div className="flex min-h-[240px] flex-col border-b border-border bg-black/20 lg:border-b-0 lg:border-r">
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
              Document
            </p>
            <div className="flex flex-1 items-center justify-center overflow-auto p-4">
              {previewUrl ? (
                previewKind === "pdf" ? (
                  <iframe
                    src={previewUrl}
                    title="Bon preview"
                    className="h-full min-h-[320px] w-full rounded-xl border border-border bg-background"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Bon"
                    className="max-h-full max-w-full rounded-xl object-contain shadow-lg"
                  />
                )
              ) : (
                <p className="text-sm text-text-secondary">Geen preview beschikbaar</p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto p-4">
            <div className="space-y-3 text-sm">
              <div>
                <FieldLabel label="Bestandsnaam" aiValue={detail.suggested_filename} edited={editedSet.has("filename")} />
                <Input
                  value={form.filename}
                  onChange={(e) => setField("filename", e.target.value)}
                  placeholder="2026-05-27_leverancier_12.50_BTW9.pdf"
                  className="font-mono text-xs"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Leverancier" aiValue={aiStr("vendor_name")} edited={editedSet.has("vendor")} />
                  <Input value={form.vendor} onChange={(e) => setField("vendor", e.target.value)} />
                </div>
                <div>
                  <FieldLabel label="Datum (DD-MM-YYYY)" aiValue={aiStr("date")} edited={editedSet.has("date")} />
                  <Input value={form.date} onChange={(e) => setField("date", e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Bedrag incl. BTW" aiValue={aiStr("total")} edited={editedSet.has("amount")} />
                  <Input value={form.amount} onChange={(e) => setField("amount", e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <FieldLabel label="BTW-tarief" edited={editedSet.has("btw_rate")} />
                  <select
                    className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                    value={form.btw_rate}
                    onChange={(e) => setField("btw_rate", e.target.value)}
                  >
                    <option value="9">9% — voedsel / koffie</option>
                    <option value="21">21% — drank / non-food</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Categorie" edited={editedSet.has("category")} />
                  <select
                    className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                  >
                    {BOKAS_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel label="Betaalwijze" edited={editedSet.has("payment_method")} />
                  <select
                    className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                    value={form.payment_method}
                    onChange={(e) => setField("payment_method", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="pin">PIN</option>
                    <option value="cash">Contant</option>
                    <option value="factuur">Op factuur</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Locatie / vestiging" edited={editedSet.has("location")} />
                  <Input value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder="Boka's lunchroom" />
                </div>
                <div>
                  <FieldLabel label="Bonnummer" edited={editedSet.has("receipt_number")} />
                  <Input value={form.receipt_number} onChange={(e) => setField("receipt_number", e.target.value)} />
                </div>
              </div>

              <div>
                <FieldLabel label="Notitie" edited={editedSet.has("note")} />
                <Input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Interne opmerking voor boekhouder" />
              </div>

              {detail.date_correction && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {detail.date_correction}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                className="rounded-xl"
                disabled={busy}
                onClick={() => void onSave(form)}
              >
                {busy ? "Opslaan…" : "Concept opslaan"}
              </Button>
              {mode === "pending" && onApprove && (
                <Button
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={busy}
                  onClick={() => void onApprove(form)}
                >
                  Opslaan & goedkeuren
                </Button>
              )}
              {mode === "pending" && onReject && (
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt("Reden van afwijzing?")?.trim();
                    if (reason) void onReject(reason);
                  }}
                >
                  Afwijzen
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
