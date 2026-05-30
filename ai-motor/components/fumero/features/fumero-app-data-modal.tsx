"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TableSchema = { name: string; columns?: Array<{ name: string; type?: string }> };

function parseTablesFromSchema(dbSchema: string | null | undefined): TableSchema[] {
  if (!dbSchema) return [{ name: "main" }];
  try {
    const s = JSON.parse(dbSchema);
    if (Array.isArray(s.tables) && s.tables.length > 0) {
      return s.tables
        .map((t: { name?: string; columns?: TableSchema["columns"] }) => ({
          name: String(t.name || "").trim(),
          columns: t.columns,
        }))
        .filter((t: TableSchema) => t.name);
    }
  } catch {
    /* ignore */
  }
  return [{ name: "main" }];
}

function formatCellValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "ja" : "nee";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 0);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function isMetaColumn(key: string): boolean {
  return key.startsWith("__");
}

export function FumeroAppDataModal({
  app,
  onClose,
}: {
  app: {
    slug: string;
    naam: string;
    row_count?: number;
    db_schema?: string | null;
  };
  onClose: () => void;
}) {
  const tables = useMemo(() => parseTablesFromSchema(app.db_schema), [app.db_schema]);
  const [activeTable, setActiveTable] = useState(tables[0]?.name ?? "main");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadTable = useCallback(
    async (tableName: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/apps/${encodeURIComponent(app.slug)}/data?table_name=${encodeURIComponent(tableName)}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as { error?: string; rows?: Record<string, unknown>[] };
        if (!res.ok) throw new Error(json.error || "Data laden mislukt");
        setRows(Array.isArray(json.rows) ? json.rows : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Data laden mislukt");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [app.slug]
  );

  useEffect(() => {
    setActiveTable(tables[0]?.name ?? "main");
  }, [tables]);

  useEffect(() => {
    void loadTable(activeTable);
  }, [activeTable, loadTable]);

  const dataColumns = useMemo(() => {
    if (rows.length === 0) return [];
    const keys = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (!isMetaColumn(k)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.entries(row).some(([k, v]) => {
        if (isMetaColumn(k)) return false;
        return formatCellValue(v).toLowerCase().includes(q);
      })
    );
  }, [rows, search]);

  const copyRow = async (row: Record<string, unknown>) => {
    const payload = Object.fromEntries(
      Object.entries(row).filter(([k]) => !isMetaColumn(k))
    );
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    const id = typeof row.__id === "number" ? row.__id : null;
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-[#E5E5E5] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E5E5] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#171717]">{app.naam}</p>
            <p className="text-xs text-[#737373]">
              {app.row_count ?? 0} rijen totaal · slug: {app.slug}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#737373] hover:bg-[#FAFAFA] hover:text-[#171717]"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {tables.length > 1 ? (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2">
            {tables.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setActiveTable(t.name)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTable === t.name
                    ? "bg-white text-[#171717] shadow-sm ring-1 ring-[#E5E5E5]"
                    : "text-[#737373] hover:text-[#171717]"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="shrink-0 border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2 text-xs text-[#737373]">
            Tabel: <span className="font-medium text-[#525252]">{activeTable}</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-b border-[#E5E5E5] px-4 py-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a3a3a3]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek in rijen…"
              className="h-8 rounded-lg border-[#E5E5E5] pl-8 text-xs"
            />
          </div>
          {!loading && rows.length > 0 ? (
            <span className="shrink-0 text-xs tabular-nums text-[#737373]">
              {filteredRows.length}/{rows.length} rijen
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#69C400]" />
              <p className="text-sm text-[#737373]">Data laden…</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-red-800">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 h-8 rounded-lg text-xs"
                onClick={() => void loadTable(activeTable)}
              >
                Opnieuw proberen
              </Button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-6 py-12 text-center">
              <p className="text-sm font-medium text-[#525252]">
                {rows.length === 0 ? "Nog geen data in deze tabel" : "Geen rijen gevonden"}
              </p>
              <p className="mt-2 max-w-sm mx-auto text-xs leading-relaxed text-[#737373]">
                {rows.length === 0
                  ? "Voeg records toe via de app zelf of vraag Max in chat om voorbeelddata te genereren. Data wordt opgeslagen via de app-data API."
                  : "Pas je zoekterm aan om andere rijen te vinden."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left">
                    {dataColumns.map((k) => (
                      <th
                        key={k}
                        className="px-3 py-2 font-medium text-[#525252] whitespace-nowrap"
                      >
                        {k}
                      </th>
                    ))}
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => {
                    const rowId = typeof row.__id === "number" ? row.__id : i;
                    return (
                      <tr
                        key={rowId}
                        className="border-b border-[#E5E5E5] last:border-0 hover:bg-[#FAFAFA]/80"
                      >
                        {dataColumns.map((k) => {
                          const v = row[k];
                          const display = formatCellValue(v);
                          const isLong = display.length > 80;
                          return (
                            <td
                              key={k}
                              className="max-w-[220px] px-3 py-2 align-top text-[#171717]"
                              title={isLong ? display : undefined}
                            >
                              <span
                                className={
                                  typeof v === "number"
                                    ? "tabular-nums font-medium"
                                    : v === true || v === false
                                      ? "rounded bg-[#E5E5E5] px-1.5 py-0.5 text-[10px] uppercase"
                                      : isLong
                                        ? "line-clamp-2 font-mono text-[11px] text-[#525252]"
                                        : ""
                                }
                              >
                                {display}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 align-top">
                          <button
                            type="button"
                            title="Kopieer rij als JSON"
                            onClick={() => void copyRow(row)}
                            className="rounded p-1.5 text-[#737373] hover:bg-[#E5E5E5] hover:text-[#171717]"
                          >
                            {copiedId === rowId ? (
                              <Check className="h-3.5 w-3.5 text-[#69C400]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#E5E5E5] px-4 py-2 text-xs text-[#737373]">
          Alleen-lezen · data via /api/apps/{app.slug}/data
        </div>
      </div>
    </div>
  );
}
