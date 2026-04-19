"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyStore } from "@/stores/useCompanyStore";
import type { Department } from "@/lib/types";
import { cn } from "@/lib/utils";

const base: Department[] = [
  {
    id: "1",
    name: "Finance Agent",
    handle: "@finance",
    status: "active",
    lastActivity: "Rapport gegenereerd",
    costEur: 12.4,
  },
  {
    id: "2",
    name: "Support Agent",
    handle: "@support",
    status: "idle",
    lastActivity: "Wacht op tickets",
    costEur: 3.2,
  },
  {
    id: "3",
    name: "Ops Agent",
    handle: "@ops",
    status: "active",
    lastActivity: "Health checks",
    costEur: 8.1,
  },
  {
    id: "4",
    name: "Legal Agent",
    handle: "@legal",
    status: "idle",
    costEur: 0,
  },
  {
    id: "5",
    name: "Marketing Agent",
    handle: "@growth",
    status: "error",
    lastActivity: "API timeout",
    costEur: 1.0,
  },
  {
    id: "6",
    name: "HR Agent",
    handle: "@hr",
    status: "idle",
    costEur: 0,
  },
];

function statusStyle(s: Department["status"]) {
  switch (s) {
    case "active":
      return "bg-success/15 text-success";
    case "error":
      return "bg-error/15 text-error";
    default:
      return "bg-text-secondary/10 text-text-secondary";
  }
}

export function AfdelingenGrid() {
  const company = useCompanyStore((s) => s.company);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {base.map((d, i) => (
        <motion.div
          key={d.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">{d.name}</CardTitle>
                  <p className="text-xs text-text-secondary">{d.handle}</p>
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
              <p className="text-text-secondary">{d.lastActivity}</p>
              <p className="text-xs text-text-secondary">
                Klant: {company}
                {d.costEur != null && d.costEur > 0 && (
                  <> · ~€{d.costEur.toFixed(2)} (mock)</>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
