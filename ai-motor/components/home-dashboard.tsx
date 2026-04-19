"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Activity, Cpu, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServices } from "@/hooks/useServices";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

const costData = [
  { month: "Jan", eur: 42 },
  { month: "Feb", eur: 58 },
  { month: "Mrt", eur: 51 },
  { month: "Apr", eur: 67 },
  { month: "Mei", eur: 72 },
  { month: "Jun", eur: 64 },
];

const activity = [
  { t: "2 min", msg: "n8n workflow · factory-os webhook OK" },
  { t: "14 min", msg: "Qdrant · index sync voltooid" },
  { t: "1 u", msg: "Embedding batch · 120 documenten" },
  { t: "3 u", msg: "Dify agent · antwoord cache vernieuwd" },
];

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        ok ? "bg-success" : "bg-error"
      )}
    />
  );
}

export function HomeDashboard() {
  const { status, loading } = useServices();
  const company = useCompanyStore((s) => s.company);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Cpu className="h-4 w-4 text-accent" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading ? (
              <p className="text-text-secondary">Laden…</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">n8n</span>
                  <StatusDot ok={status.n8n} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Qdrant</span>
                  <StatusDot ok={status.qdrant} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Ollama</span>
                  <StatusDot ok={status.ollama} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Dify</span>
                  <StatusDot ok={status.dify} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Euro className="h-4 w-4 text-accent" />
              Mock kosten (maand)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">
              €{costData[costData.length - 1].eur}
            </p>
            <p className="text-xs text-text-secondary">
              Demo-data · klant: {company}
            </p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Activity className="h-4 w-4 text-accent" />
              Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costData}>
                <defs>
                  <linearGradient id="fillEur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} width={28} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="eur"
                  stroke="var(--accent)"
                  fill="url(#fillEur)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Activiteit</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {activity.map((a, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <span className="shrink-0 text-xs text-text-secondary">{a.t}</span>
                <span className="text-sm">{a.msg}</span>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
