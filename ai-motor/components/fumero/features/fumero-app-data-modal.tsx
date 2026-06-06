"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Search } from "lucide-react";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system/components";

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
  open,
  onClose,
}: {
  app: {
    slug: string;
    naam: string;
    row_count?: number;
    db_schema?: string | null;
  };
  open: boolean;
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
    if (open) void loadTable(activeTable);
  }, [activeTable, loadTable, open]);

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
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ModalContent className="flex max-h-[85vh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 p-0">
        <ModalHeader className="border-b border-border px-4 py-4">
          <ModalTitle className="truncate">{app.naam}</ModalTitle>
          <ModalDescription>
            {app.row_count ?? 0} rijen · app: {app.slug}
          </ModalDescription>
        </ModalHeader>

        {tables.length > 1 ? (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface-elevated px-3 py-2">
            {tables.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setActiveTable(t.name)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors min-h-[var(--ds-touch-min)] ${
                  activeTable === t.name
                    ? "bg-surface text-text-primary shadow-sm ring-1 ring-border"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="shrink-0 border-b border-border bg-surface-elevated px-4 py-2 text-sm text-text-secondary">
            Tabel: <span className="font-medium text-text-primary">{activeTable}</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek in rijen…"
              touchFriendly
              className="rounded-xl pl-10"
              aria-label="Zoek in data"
            />
          </div>
          {!loading && rows.length > 0 ? (
            <span className="shrink-0 text-sm tabular-nums text-text-secondary">
              {filteredRows.length}/{rows.length}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
              <p className="text-sm text-text-secondary">Data laden…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-6 text-center">
              <p className="text-sm font-medium text-error">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="touch"
                className="mt-3 rounded-xl"
                onClick={() => void loadTable(activeTable)}
              >
                Opnieuw proberen
              </Button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-elevated px-6 py-12 text-center">
              <p className="text-sm font-medium text-text-primary">
                {rows.length === 0 ? "Nog geen data" : "Geen rijen gevonden"}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
                {rows.length === 0
                  ? "Gebruik de app of vraag Max in chat om voorbeeldgegevens te maken."
                  : "Pas je zoekterm aan."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {dataColumns.map((k) => (
                      <TableHead key={k} className="whitespace-nowrap">
                        {k}
                      </TableHead>
                    ))}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, i) => {
                    const rowId = typeof row.__id === "number" ? row.__id : i;
                    return (
                      <TableRow key={rowId}>
                        {dataColumns.map((k) => {
                          const v = row[k];
                          const display = formatCellValue(v);
                          const isLong = display.length > 80;
                          return (
                            <TableCell
                              key={k}
                              className="max-w-[220px] align-top"
                              title={isLong ? display : undefined}
                            >
                              <span
                                className={
                                  typeof v === "number"
                                    ? "tabular-nums font-medium"
                                    : isLong
                                      ? "line-clamp-2 font-mono text-xs text-text-secondary"
                                      : ""
                                }
                              >
                                {display}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="align-top">
                          <button
                            type="button"
                            title="Rij kopiëren"
                            aria-label="Rij kopiëren"
                            onClick={() => void copyRow(row)}
                            className="inline-flex min-h-[var(--ds-touch-min)] min-w-[var(--ds-touch-min)] items-center justify-center rounded-lg text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                          >
                            {copiedId === rowId ? (
                              <Check className="h-4 w-4 text-accent" aria-hidden />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3 text-sm text-text-secondary">
          Alleen lezen — data van je app
        </div>
      </ModalContent>
    </Modal>
  );
}
