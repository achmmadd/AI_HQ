"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

type ApiAfdeling = {
  id: string;
  naam: string;
  icon: string;
  beschrijving: string;
  model: string;
  klanten: string[];
  status: string;
  laatste_activiteit: string;
  taken_vandaag: number;
  kosten_vandaag: string;
};

function statusStyle(status: string) {
  if (status === "actief") return "bg-success/15 text-success";
  if (status === "offline") return "bg-error/15 text-error";
  return "bg-text-secondary/10 text-text-secondary";
}

export function AfdelingenGrid() {
  const company = useCompanyStore((s) => s.company);
  const [rows, setRows] = useState<ApiAfdeling[]>([]);
  const [n8nOnline, setN8nOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/afdelingen");
      const j = await r.json();
      setRows(Array.isArray(j.afdelingen) ? j.afdelingen : []);
      setN8nOnline(typeof j.n8n_online === "boolean" ? j.n8n_online : null);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Klant: <strong>{company}</strong>
          {n8nOnline != null && (
            <>
              {" · "}
              n8n: {n8nOnline ? "online" : "offline"}
            </>
          )}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-xl"
          onClick={() => void load()}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Vernieuwen
        </Button>
      </div>
      {loading && <p className="text-sm text-text-secondary">Laden…</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated text-lg"
                    aria-hidden
                  >
                    {d.icon ? (
                      <span>{d.icon}</span>
                    ) : (
                      <Bot className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {d.naam}
                    </CardTitle>
                    <p className="text-xs text-text-secondary">{d.model}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                    statusStyle(d.status)
                  )}
                >
                  {d.status}
                </span>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-text-secondary">{d.beschrijving}</p>
                <p className="text-xs text-text-secondary">
                  Taken vandaag (mock): {d.taken_vandaag} · €{d.kosten_vandaag}
                </p>
                <p className="text-[10px] text-text-secondary">
                  {new Date(d.laatste_activiteit).toLocaleString("nl-NL")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
