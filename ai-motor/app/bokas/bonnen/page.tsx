"use client";

import { useCallback, useEffect, useState } from "react";
import { BokasShell } from "@/components/bokas/bokas-shell";
import {
  BookkeepingReviewPanel,
  type ReviewDetail,
  type ReviewForm,
} from "@/app/components/bokas/bookkeeping-review-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BookkeepingHealth = {
  status?: string;
  pending_approvals?: number;
  retry_queue?: number;
  disk_free_mb?: number;
  error?: string;
};

type Receipt = {
  id: string;
  token?: string;
  vendor?: string;
  amount?: number;
  date?: string;
  status?: string;
  tax?: number | null;
  note?: string | null;
  type?: string;
  date_correction?: string | null;
  btw_rates?: number[];
};

type RetryItem = {
  id: number;
  vendor?: string;
  amount?: number;
  date?: string;
  pdf_name?: string;
  retry_count?: number;
  created_at?: string;
};

type BankUpload = {
  id: string;
  year: number;
  month: number;
  label?: string;
  filename?: string;
  uploaded_at?: string;
  row_count?: number;
  preview_rows?: { date: string; description: string; amount: string }[];
};

type TabId = "inbox" | "verwerkt" | "facturen" | "bank" | "export";

function statusBadge(status?: string) {
  const s = status ?? "unknown";
  const map: Record<string, string> = {
    awaiting_approval:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  };
  const cls = map[s] ?? "bg-surface-elevated text-text-secondary border-border";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase", cls)}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

function formatDateInput(iso?: string) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return iso;
}

type ApprovalRow = {
  id: number;
  title: string;
  description: string | null;
  action: string;
  status: string;
  created_at: string;
};

type OdooBill = {
  id: number;
  name?: string;
  vendor?: string;
  invoice_date?: string;
  amount_total?: number;
  amount_tax?: number;
  amount_untaxed?: number;
  state?: string;
  ref?: string;
};

type OdooBillsResponse = {
  ok?: boolean;
  year?: number;
  quarter?: number | null;
  items?: OdooBill[];
  summary?: { count?: number; total_incl?: number; total_tax?: number };
  error?: string;
};

type ExportDocument = {
  path: string;
  filename: string;
  vendor?: string;
  date?: string;
  amount?: string;
  doc_type?: string;
  month?: number;
};

type DocumentsResponse = {
  ok?: boolean;
  year?: number;
  quarter?: number;
  items?: ExportDocument[];
  summary?: { count?: number; total_incl?: number };
  error?: string;
};

function docUrl(path: string, download = false) {
  const qs = new URLSearchParams({ path });
  if (download) qs.set("download", "1");
  return `/api/bookkeeping/document?${qs}`;
}

function findDocForBill(bill: OdooBill, docs: ExportDocument[]): ExportDocument | undefined {
  const amt =
    bill.amount_total != null ? bill.amount_total.toFixed(2) : null;
  return docs.find(
    (d) =>
      d.date === bill.invoice_date &&
      amt != null &&
      d.amount === amt &&
      (d.vendor ?? "").toLowerCase().includes((bill.vendor ?? "").slice(0, 6).toLowerCase())
  );
}

function downloadCsv(rows: OdooBill[], year: number, quarter: number | null) {
  const header = "datum;leverancier;bedrag_incl_btw;btw;excl_btw;status;odoo_id;referentie";
  const lines = rows.map((r) =>
    [
      r.invoice_date ?? "",
      (r.vendor ?? "").replace(/;/g, ","),
      r.amount_total?.toFixed(2) ?? "",
      r.amount_tax?.toFixed(2) ?? "",
      r.amount_untaxed?.toFixed(2) ?? "",
      r.state ?? "",
      String(r.id),
      (r.ref ?? "").replace(/;/g, ","),
    ].join(";")
  );
  const blob = new Blob([[header, ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `odoo_bonnen_${year}${quarter ? `_Q${quarter}` : ""}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-text-primary">
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-[11px] text-text-secondary">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BokasBonnenPage() {
  const [health, setHealth] = useState<BookkeepingHealth | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [odooBills, setOdooBills] = useState<OdooBill[]>([]);
  const [exportDocs, setExportDocs] = useState<ExportDocument[]>([]);
  const [odooSummary, setOdooSummary] = useState<OdooBillsResponse["summary"]>();
  const [filterYear, setFilterYear] = useState(2026);
  const [filterQuarter, setFilterQuarter] = useState<number | "">(1);
  const [odooErr, setOdooErr] = useState<string | null>(null);
  const [docsErr, setDocsErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("inbox");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDetail, setReviewDetail] = useState<ReviewDetail | null>(null);
  const [reviewMode, setReviewMode] = useState<"pending" | "processed">("pending");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterType, setFilterType] = useState<"" | "bon" | "factuur">("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceNote, setInvoiceNote] = useState("");
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [bankUploads, setBankUploads] = useState<BankUpload[]>([]);
  const [bankYear, setBankYear] = useState(2026);
  const [bankMonth, setBankMonth] = useState(5);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankLabel, setBankLabel] = useState("");
  const [bankBusy, setBankBusy] = useState(false);
  const [retryItems, setRetryItems] = useState<RetryItem[]>([]);
  const [retryBusy, setRetryBusy] = useState(false);

  const loadOdoo = useCallback(async (year: number, quarter: number | "") => {
    setOdooErr(null);
    setDocsErr(null);
    try {
      const qs = new URLSearchParams({ year: String(year) });
      if (quarter !== "") qs.set("quarter", String(quarter));

      const fetches: Promise<Response>[] = [
        fetch(`/api/bookkeeping/odoo-bills?${qs}`, { credentials: "include" }),
      ];
      if (quarter !== "") {
        fetches.push(
          fetch(`/api/bookkeeping/documents?${qs}`, { credentials: "include" })
        );
      } else {
        setExportDocs([]);
      }

      const [billsRes, docsRes] = await Promise.all(fetches);

      const j = (await billsRes.json()) as OdooBillsResponse;
      if (!billsRes.ok || j.ok === false) {
        throw new Error(j.error || billsRes.statusText);
      }
      setOdooBills(Array.isArray(j.items) ? j.items : []);
      setOdooSummary(j.summary);

      if (docsRes) {
        const dj = (await docsRes.json()) as DocumentsResponse;
        if (!docsRes.ok || dj.ok === false) {
          setExportDocs([]);
          setDocsErr(dj.error || docsRes.statusText);
        } else {
          setExportDocs(Array.isArray(dj.items) ? dj.items : []);
        }
      }
    } catch (e) {
      setOdooBills([]);
      setExportDocs([]);
      setOdooSummary(undefined);
      setOdooErr(e instanceof Error ? e.message : "Odoo laden mislukt");
    }
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [hRes, rRes, aRes] = await Promise.all([
        fetch("/api/bookkeeping/health", { credentials: "include" }),
        fetch("/api/bookkeeping/recent", { credentials: "include" }),
        fetch("/api/approvals", { credentials: "include" }),
      ]);
      const hJson = (await hRes.json()) as BookkeepingHealth;
      const rJson = (await rRes.json()) as { receipts?: Receipt[] };
      const aJson = (await aRes.json()) as {
        approvals?: ApprovalRow[];
        pending?: ApprovalRow[];
      };

      setHealth(hJson);
      setReceipts(Array.isArray(rJson.receipts) ? rJson.receipts : []);
      setApprovals(
        Array.isArray(aJson.approvals)
          ? aJson.approvals
          : Array.isArray(aJson.pending)
            ? aJson.pending
            : []
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    }
  }, []);

  const loadBank = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/bookkeeping/bank?year=${year}`, {
        credentials: "include",
      });
      const j = (await res.json()) as { items?: BankUpload[] };
      setBankUploads(Array.isArray(j.items) ? j.items : []);
    } catch {
      setBankUploads([]);
    }
  }, []);

  const loadRetry = useCallback(async () => {
    try {
      const res = await fetch("/api/bookkeeping/retry", { credentials: "include" });
      const j = (await res.json()) as { items?: RetryItem[] };
      setRetryItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setRetryItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadRetry();
  }, [load, loadRetry]);

  useEffect(() => {
    if (tab === "verwerkt" || tab === "export") void loadOdoo(filterYear, filterQuarter);
  }, [tab, filterYear, filterQuarter, loadOdoo]);

  useEffect(() => {
    if (tab === "bank") void loadBank(bankYear);
  }, [tab, bankYear, loadBank]);

  const wachtend =
    typeof health?.pending_approvals === "number"
      ? health.pending_approvals
      : receipts.filter((x) => x.status === "awaiting_approval").length;

  const verwerkt = receipts.filter(
    (x) =>
      x.status &&
      x.status !== "awaiting_approval" &&
      x.status !== "rejected"
  ).length;

  const odooQueue =
    typeof health?.retry_queue === "number" ? health.retry_queue : 0;

  const totaal = receipts.length;
  const pendingReceipts = receipts.filter((x) => {
    if (x.status !== "awaiting_approval") return false;
    if (filterType && x.type !== filterType) return false;
    if (filterVendor && !(x.vendor ?? "").toLowerCase().includes(filterVendor.toLowerCase())) return false;
    if (searchQuery && !(x.vendor ?? "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  function formToPayload(form: ReviewForm) {
    const amount = form.amount.trim() ? Number(form.amount) : undefined;
    return {
      vendor: form.vendor.trim() || undefined,
      date: form.date.trim() || undefined,
      amount: amount != null && Number.isFinite(amount) ? amount : undefined,
      note: form.note,
      btw_rate: form.btw_rate === "21" ? 21 : 9,
      filename: form.filename.trim() || undefined,
      category: form.category || undefined,
      location: form.location.trim() || undefined,
      payment_method: form.payment_method || undefined,
      receipt_number: form.receipt_number.trim() || undefined,
    };
  }

  async function openReview(
    mode: "pending" | "processed",
    id: { token?: string; path?: string }
  ) {
    setReviewBusy(true);
    setErr(null);
    try {
      const url =
        mode === "pending" && id.token
          ? `/api/bookkeeping/detail?token=${encodeURIComponent(id.token)}`
          : id.path
            ? `/api/bookkeeping/processed?path=${encodeURIComponent(id.path)}`
            : null;
      if (!url) throw new Error("Geen token of pad");
      const res = await fetch(url, { credentials: "include" });
      const j = (await res.json()) as { receipt?: ReviewDetail; detail?: string; error?: string };
      if (!res.ok) throw new Error(j.detail || j.error || res.statusText);
      setReviewDetail(j.receipt ?? null);
      setReviewMode(mode);
      setReviewOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Review laden mislukt");
    } finally {
      setReviewBusy(false);
    }
  }

  async function saveReviewDraft(form: ReviewForm) {
    setReviewBusy(true);
    setErr(null);
    try {
      const payload = formToPayload(form);
      if (reviewMode === "pending" && reviewDetail?.token) {
        const res = await fetch("/api/bookkeeping/edit", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: reviewDetail.token, ...payload }),
        });
        const j = (await res.json()) as { receipt?: ReviewDetail; detail?: string; error?: string };
        if (!res.ok) throw new Error(j.detail || j.error || res.statusText);
        setReviewDetail(j.receipt ?? reviewDetail);
        await load();
      } else if (reviewMode === "processed" && reviewDetail?.path) {
        const res = await fetch("/api/bookkeeping/processed", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: reviewDetail.path, ...payload }),
        });
        const j = (await res.json()) as { receipt?: ReviewDetail; detail?: string; error?: string };
        if (!res.ok) throw new Error(j.detail || j.error || res.statusText);
        await loadOdoo(filterYear, filterQuarter);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setReviewBusy(false);
    }
  }

  async function approveFromReview(form: ReviewForm) {
    if (!reviewDetail?.token) return;
    await saveReviewDraft(form);
    const amt = form.amount.trim() ? Number(form.amount) : reviewDetail.amount;
    await resolveReceipt(
      {
        id: reviewDetail.token,
        token: reviewDetail.token,
        vendor: form.vendor || reviewDetail.vendor,
        amount: typeof amt === "number" && Number.isFinite(amt) ? amt : undefined,
      },
      "approve"
    );
    setReviewOpen(false);
    setReviewDetail(null);
  }

  async function bulkAction(action: "approve" | "reject") {
    const tokens = [...selected];
    if (tokens.length === 0) return;
    let reason = "";
    if (action === "reject") {
      reason = window.prompt("Waarom wijs je deze bonnen af?")?.trim() || "";
      if (!reason) return;
    }
    setBusyId("bulk");
    setErr(null);
    try {
      const res = await fetch("/api/bookkeeping/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, action, reason }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      setSelected(new Set());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bulk-actie mislukt");
    } finally {
      setBusyId(null);
    }
  }

  async function flushRetry() {
    setRetryBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/bookkeeping/retry", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { error?: string; before?: number; after?: number };
      if (!res.ok) throw new Error(j.error || res.statusText);
      await Promise.all([load(), loadRetry()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Odoo retry mislukt");
    } finally {
      setRetryBusy(false);
    }
  }

  function previewUrl(token: string) {
    return `/api/bookkeeping/preview?token=${encodeURIComponent(token)}`;
  }

  async function uploadInvoice() {
    if (!invoiceFile) return;
    setInvoiceBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", invoiceFile);
      if (invoiceNote.trim()) fd.append("note", invoiceNote.trim());
      const res = await fetch("/api/bookkeeping/upload-invoice", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(j.detail || j.error || res.statusText);
      setInvoiceFile(null);
      setInvoiceNote("");
      setTab("inbox");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Factuur upload mislukt");
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function uploadBank() {
    if (!bankFile) return;
    setBankBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", bankFile);
      fd.append("year", String(bankYear));
      fd.append("month", String(bankMonth));
      if (bankLabel.trim()) fd.append("label", bankLabel.trim());
      const res = await fetch("/api/bookkeeping/bank", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(j.detail || j.error || res.statusText);
      setBankFile(null);
      setBankLabel("");
      await loadBank(bankYear);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bankupload mislukt");
    } finally {
      setBankBusy(false);
    }
  }

  function toggleSelect(token: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  }

  async function patchApproval(id: number, status: "approved" | "rejected") {
    let reject_reason = "";
    if (status === "rejected") {
      reject_reason = window.prompt("Waarom wijs je deze goedkeuring af?")?.trim() || "";
      if (!reject_reason) return;
    }

    setBusyId(`approval:${id}`);
    setErr(null);
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reject_reason }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "PATCH mislukt");
    } finally {
      setBusyId(null);
    }
  }

  async function resolveReceipt(receipt: Receipt, action: "approve" | "reject") {
    const token = receipt.token || receipt.id;
    let reason = "";
    if (action === "reject") {
      reason = window.prompt("Waarom wijs je deze bon af?")?.trim() || "";
      if (!reason) return;
    }

    setBusyId(`receipt:${token}`);
    setErr(null);
    try {
      const res = await fetch("/api/bookkeeping/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: token,
          action,
          reason,
          vendor: receipt.vendor,
          amount: receipt.amount,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bon verwerken mislukt");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadQuarterZip() {
    if (filterQuarter === "") {
      window.alert("Kies een kwartaal voor de ZIP-export.");
      return;
    }
    setExportBusy(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        year: String(filterYear),
        quarter: String(filterQuarter),
      });
      const res = await fetch(`/api/bookkeeping/export?${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const filename =
        match?.[1] ??
        `${filterYear}-Q${filterQuarter}-Bokas-export.zip`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ZIP-export mislukt");
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <BokasShell page="Boekhouding · Boka's">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl border border-border bg-surface-elevated/40 px-4 py-3 text-sm text-text-secondary">
          <strong className="text-text-primary">Human-in-the-loop:</strong> scan → controleer &amp; pas aan → concept opslaan → goedkeuren → Odoo + archief.
          Geïnspireerd op Moneybird-inbox: document links, gegevens rechts, jij beslist vóór boeking.
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {(
            [
              ["inbox", `Inbox${wachtend ? ` (${wachtend})` : ""}`],
              ["verwerkt", "Verwerkt"],
              ["facturen", "Facturen"],
              ["bank", "Bank"],
              ["export", "Export & BTW"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id
                  ? "bg-accent text-white"
                  : "bg-surface-elevated text-text-secondary hover:text-text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {err && (
          <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {err}
          </p>
        )}

        {tab === "inbox" && (
        <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Wachtend"
            value={health?.error ? "—" : wachtend}
            sub="pending_approvals / bonnen"
          />
          <MetricCard
            label="Verwerkt (recent)"
            value={verwerkt}
            sub="Status ≠ awaiting in lijst"
          />
          <MetricCard
            label="Odoo-queue"
            value={health?.error ? "—" : odooQueue}
            sub="retry_queue (bookkeeping-bot)"
          />
          <MetricCard label="Totaal recent" value={totaal} sub="Bonregels" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                Inbox · wacht op jouw review
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-xl border border-border bg-surface-elevated px-2 py-1 text-xs"
                  placeholder="Zoeken…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="rounded-xl border border-border bg-surface-elevated px-2 py-1 text-xs"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "" | "bon" | "factuur")}
                >
                  <option value="">Alles</option>
                  <option value="bon">Bon</option>
                  <option value="factuur">Factuur</option>
                </select>
                {selected.size > 0 && (
                  <>
                    <Button size="sm" className="rounded-xl" disabled={busyId === "bulk"} onClick={() => void bulkAction("approve")}>
                      Bulk OK ({selected.size})
                    </Button>
                    <Button size="sm" variant="secondary" className="rounded-xl" disabled={busyId === "bulk"} onClick={() => void bulkAction("reject")}>
                      Bulk afwijzen
                    </Button>
                  </>
                )}
                <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={() => void load()}>
                  Vernieuwen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pendingReceipts.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Geen openstaande bonnen. Upload een factuur onder tab Digitale facturen, of stuur een foto naar Telegram.
                </p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {pendingReceipts.map((r) => {
                    const token = r.token || r.id;
                    const isBusy = busyId === `receipt:${token}` || busyId === `edit:${token}`;
                    const checked = selected.has(token);
                    return (
                      <li
                        key={token}
                        className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleSelect(token)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-text-primary truncate">
                                {r.vendor ?? token.slice(0, 8)}
                              </p>
                              {statusBadge(r.status)}
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                              {r.date ?? "Geen datum"} · {r.type ?? "bon"}
                              {r.btw_rates && r.btw_rates.length > 0
                                ? ` · BTW ${r.btw_rates.join("/")}%`
                                : r.tax != null
                                  ? ` · BTW €${r.tax.toFixed(2)}`
                                  : ""}
                            </p>
                            {r.date_correction && (
                              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                {r.date_correction}
                              </p>
                            )}
                            {r.note && (
                              <p className="mt-1 text-[11px] italic text-text-secondary">{r.note}</p>
                            )}
                            <p className="mt-1 tabular-nums text-sm font-semibold">
                              {r.amount != null ? `€${r.amount.toFixed(2)}` : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" size="sm" className="rounded-xl" disabled={isBusy} onClick={() => void openReview("pending", { token })}>
                            Review &amp; bewerken
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="rounded-xl" disabled={isBusy} onClick={() => void resolveReceipt(r, "approve")}>
                            Snel OK
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="rounded-xl" disabled={isBusy} onClick={() => void resolveReceipt(r, "reject")}>
                            Afwijzen
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {(odooQueue > 0 || retryItems.length > 0) && (
            <Card className="lg:col-span-2 border-red-500/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Odoo retry-wachtrij</CardTitle>
                  <p className="mt-1 text-xs text-text-secondary">
                    Bonnen die goedgekeurd zijn maar niet in Odoo zijn geland. Typisch bij korte Odoo-storing.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  disabled={retryBusy || retryItems.length === 0}
                  onClick={() => void flushRetry()}
                >
                  {retryBusy ? "Retry…" : "Opnieuw naar Odoo"}
                </Button>
              </CardHeader>
              <CardContent>
                {retryItems.length === 0 ? (
                  <p className="text-sm text-text-secondary">{odooQueue} items in queue (laden…)</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {retryItems.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2 rounded-lg border border-border px-3 py-2">
                        <span>
                          {item.vendor ?? "Onbekend"} · {item.date ?? "—"}
                          {item.retry_count != null && item.retry_count > 0 ? (
                            <span className="ml-1 text-xs text-amber-600">({item.retry_count}× geprobeerd)</span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-text-secondary">
                          {item.amount != null ? `€${item.amount.toFixed(2)}` : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Goedkeuringen (Motor)</CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => void load()}
              >
                Vernieuwen
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvals.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Geen openstaande goedkeuringen.
                </p>
              ) : (
                <ul className="space-y-3">
                  {approvals.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-border bg-surface-elevated/40 p-3"
                    >
                      <p className="font-medium text-text-primary">
                        #{a.id} · {a.title}
                      </p>
                      {a.description && (
                        <p className="mt-1 text-xs text-text-secondary">
                          {a.description}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-text-secondary">
                        {a.action} · {a.created_at}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          disabled={busyId === `approval:${a.id}`}
                          onClick={() => void patchApproval(a.id, "approved")}
                        >
                          Goedkeuren
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="rounded-xl"
                          disabled={busyId === `approval:${a.id}`}
                          onClick={() => void patchApproval(a.id, "rejected")}
                        >
                          Afwijzen
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recente bonnen</CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Geen bonnen in /recent.
                </p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {receipts.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">
                          {r.vendor ?? r.id.slice(0, 8)}
                        </span>
                        <span className="tabular-nums text-text-secondary">
                          {r.amount != null ? `€${r.amount}` : "—"}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-text-secondary">
                        <span>{r.date ?? "—"}</span>
                        <span
                          className={cn(
                            r.status === "awaiting_approval" &&
                              "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {r.status ?? "—"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}

        {tab === "facturen" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Digitale facturen (PDF)</CardTitle>
              <p className="mt-1 text-xs text-text-secondary">
                Upload een PDF-factuur direct hier, of stuur hem naar de Telegram bon-bot.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-elevated/40 p-4 text-sm">
                <p className="font-medium text-text-primary">Via Gmail (automatisch)</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-text-secondary">
                  <li>Stel Gmail Apps Script of Zapier/Make in: nieuwe mail met PDF → Telegram bot.</li>
                  <li>Of forward de PDF handmatig naar de bon-bot in Telegram.</li>
                </ol>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  PDF-factuur
                  <input type="file" accept="application/pdf" className="mt-1 block w-full text-sm" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                </label>
                <label className="block text-sm">
                  Notitie (optioneel)
                  <input className="mt-1 w-full rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={invoiceNote} onChange={(e) => setInvoiceNote(e.target.value)} placeholder="bijv. Gmail leverancier X" />
                </label>
              </div>
              <Button type="button" className="rounded-xl" disabled={!invoiceFile || invoiceBusy} onClick={() => void uploadInvoice()}>
                {invoiceBusy ? "Verwerken…" : "Factuur uploaden → Inbox"}
              </Button>
            </CardContent>
          </Card>
        )}

        {tab === "export" && (
        <>
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base">BTW &amp; kwartaal · Boka&apos;s</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
            <p><strong className="text-text-primary">9% BTW</strong> — voedsel, koffie/thee (AH, Sligro food).</p>
            <p><strong className="text-text-primary">21% BTW</strong> — drank, verpakking, huur, energie.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Odoo · kwartaaloverzicht</CardTitle>
              <p className="mt-1 text-xs text-text-secondary">Vendor bills + ZIP export naar boekhouder.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                {[2026, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={filterQuarter === "" ? "" : String(filterQuarter)} onChange={(e) => setFilterQuarter(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Heel jaar</option>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
              </select>
              <Button type="button" variant="secondary" size="sm" className="rounded-xl" disabled={odooBills.length === 0} onClick={() => downloadCsv(odooBills, filterYear, filterQuarter === "" ? null : filterQuarter)}>CSV</Button>
              <Button type="button" variant="secondary" size="sm" className="rounded-xl" disabled={filterQuarter === "" || exportBusy} onClick={() => void downloadQuarterZip()}>{exportBusy ? "ZIP…" : "ZIP boekhouder"}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {odooErr && <p className="mb-3 rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{odooErr}</p>}
            {odooSummary && (
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Facturen" value={odooSummary.count ?? 0} sub={`${filterYear}${filterQuarter !== "" ? ` Q${filterQuarter}` : ""}`} />
                <MetricCard label="Totaal incl BTW" value={odooSummary.total_incl != null ? `€${odooSummary.total_incl.toFixed(2)}` : "—"} />
                <MetricCard label="BTW totaal" value={odooSummary.total_tax != null ? `€${odooSummary.total_tax.toFixed(2)}` : "—"} />
              </div>
            )}
            {odooBills.length === 0 ? (
              <p className="text-sm text-text-secondary">Geen vendor bills in Odoo voor deze periode.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-text-secondary">
                      <th className="py-2 pr-3">Datum</th>
                      <th className="py-2 pr-3">Leverancier</th>
                      <th className="py-2 pr-3 text-right">Incl BTW</th>
                      <th className="py-2 pr-3 text-right">BTW</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {odooBills.map((b) => (
                      <tr key={b.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 tabular-nums">{b.invoice_date ?? "—"}</td>
                        <td className="py-2 pr-3">{b.vendor ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.amount_total != null ? `€${b.amount_total.toFixed(2)}` : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.amount_tax != null ? `€${b.amount_tax.toFixed(2)}` : "—"}</td>
                        <td className="py-2 pr-3 text-xs">{b.state ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}

        {tab === "verwerkt" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verwerkte bonnen · Q{filterQuarter || "—"} {filterYear}</CardTitle>
              <p className="mt-1 text-xs text-text-secondary">
                Goedgekeurde PDF&apos;s in export_boekhouder. Klik bewerken om bestandsnaam, leverancier of BTW aan te passen.
              </p>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                <select className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                  {[2026, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={filterQuarter === "" ? "" : String(filterQuarter)} onChange={(e) => setFilterQuarter(e.target.value === "" ? "" : Number(e.target.value))}>
                  {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
              {exportDocs.length === 0 ? (
                <p className="text-sm text-text-secondary">Geen verwerkte bonnen voor dit kwartaal.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-text-secondary">
                        <th className="py-2 pr-3">Datum</th>
                        <th className="py-2 pr-3">Leverancier</th>
                        <th className="py-2 pr-3 text-right">Bedrag</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportDocs.map((d) => (
                        <tr key={d.path} className="border-b border-border/60">
                          <td className="py-2 pr-3 tabular-nums">{d.date ?? "—"}</td>
                          <td className="py-2 pr-3">{d.vendor ?? d.filename}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{d.amount ? `€${d.amount}` : "—"}</td>
                          <td className="py-2 pr-3 text-xs capitalize">{d.doc_type ?? "—"}</td>
                          <td className="py-2">
                            <span className="flex flex-wrap gap-2 text-xs">
                              <button type="button" className="text-accent hover:underline" onClick={() => void openReview("processed", { path: d.path })}>Bewerken</button>
                              <a href={docUrl(d.path)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Open</a>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "bank" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bankafschrift uploaden</CardTitle>
                <p className="mt-1 text-xs text-text-secondary">
                  Upload CSV of PDF per maand. Automatisch matchen met bonnen volgt later — nu opslag + overzicht.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <select className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={bankYear} onChange={(e) => setBankYear(Number(e.target.value))}>
                    {[2026, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" value={bankMonth} onChange={(e) => setBankMonth(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input className="rounded-xl border border-border bg-surface-elevated px-2 py-1.5 text-sm" placeholder="Label (optioneel)" value={bankLabel} onChange={(e) => setBankLabel(e.target.value)} />
                </div>
                <input type="file" accept=".csv,.pdf,.txt,text/csv,application/pdf" className="text-sm" onChange={(e) => setBankFile(e.target.files?.[0] ?? null)} />
                <Button type="button" className="rounded-xl" disabled={!bankFile || bankBusy} onClick={() => void uploadBank()}>
                  {bankBusy ? "Uploaden…" : "Afschrift opslaan"}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Opgeslagen afschriften · {bankYear}</CardTitle></CardHeader>
              <CardContent>
                {bankUploads.length === 0 ? (
                  <p className="text-sm text-text-secondary">Nog geen bankuploads voor dit jaar.</p>
                ) : (
                  <ul className="space-y-3">
                    {bankUploads.map((b) => (
                      <li key={b.id} className="rounded-xl border border-border p-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{b.label ?? b.filename}</span>
                          <span className="text-text-secondary">{b.month}/{b.year}</span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{b.row_count ?? 0} regels · {b.uploaded_at?.slice(0, 10)}</p>
                        {b.preview_rows && b.preview_rows.length > 0 && (
                          <table className="mt-2 w-full text-[11px]">
                            <tbody>
                              {b.preview_rows.slice(0, 5).map((row, i) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="py-1 pr-2">{row.date}</td>
                                  <td className="py-1 pr-2 truncate">{row.description}</td>
                                  <td className="py-1 text-right tabular-nums">{row.amount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <BookkeepingReviewPanel
          open={reviewOpen}
          mode={reviewMode}
          detail={reviewDetail}
          previewUrl={
            reviewMode === "pending" && reviewDetail?.token
              ? previewUrl(reviewDetail.token)
              : reviewMode === "processed" && reviewDetail?.path
                ? docUrl(reviewDetail.path)
                : null
          }
          busy={reviewBusy}
          onClose={() => { setReviewOpen(false); setReviewDetail(null); }}
          onSave={saveReviewDraft}
          onApprove={reviewMode === "pending" ? approveFromReview : undefined}
          onReject={
            reviewMode === "pending" && reviewDetail?.token
              ? async (reason) => {
                  setReviewBusy(true);
                  try {
                    const res = await fetch("/api/bookkeeping/approve", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        receipt_id: reviewDetail.token,
                        action: "reject",
                        reason,
                        vendor: reviewDetail.vendor,
                        amount: reviewDetail.amount,
                      }),
                    });
                    if (!res.ok) {
                      const j = (await res.json()) as { error?: string };
                      throw new Error(j.error || res.statusText);
                    }
                    setReviewOpen(false);
                    setReviewDetail(null);
                    await load();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Afwijzen mislukt");
                  } finally {
                    setReviewBusy(false);
                  }
                }
              : undefined
          }
        />
      </div>
    </BokasShell>
  );
}
