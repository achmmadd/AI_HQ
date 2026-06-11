"use client";

import { useCallback, useEffect, useState } from "react";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";
import {
  formatBriefingAge,
  type FumeroStudioKpis,
} from "@/lib/fumero/studio-kpis";

type AutomationTaskRow = { task_key: string; enabled: number };

export function useFumeroStudioKpis(): FumeroStudioKpis & { loading: boolean } {
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [activeAutomations, setActiveAutomations] = useState<number | null>(null);
  const [openOrdersCount, setOpenOrdersCount] = useState<number | null>(null);
  const [briefingAgeLabel, setBriefingAgeLabel] = useState<string | null>(null);
  const [monthlyCostEur, setMonthlyCostEur] = useState<number | null>(null);
  const [hoursSaved, setHoursSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [contentRes, ordersRes, tasksRes, briefingRes, usageRes, kpiRes] =
        await Promise.all([
          fetch("/api/content?klant=fumero", { credentials: "include" }),
          fetch("/api/fumero/orders?limit=100", { credentials: "include" }),
          fetch("/api/automation/tasks", { credentials: "include" }),
          fetch("/api/fumero/briefing", { credentials: "include" }),
          fetch("/api/usage/summary?period=month&klant=fumero", {
            credentials: "include",
          }),
          fetch("/api/kpi?klant=fumero", { credentials: "include" }),
        ]);

      const content = (await contentRes.json()) as { posts?: unknown[] };
      const orders = (await ordersRes.json()) as { orders?: unknown[] };
      const tasksJson = (await tasksRes.json()) as { tasks?: AutomationTaskRow[] };
      const briefing = (await briefingRes.json()) as { generated_at?: string };
      const usage = (await usageRes.json()) as { total_eur?: number };
      const kpi = (await kpiRes.json()) as {
        time_saved?: { hours_estimate?: number };
      };

      setLibraryCount(
        Array.isArray(content.posts) ? content.posts.length : 0
      );
      setOpenOrdersCount(
        Array.isArray(orders.orders) ? orders.orders.length : 0
      );
      const fumeroTasks = (tasksJson.tasks ?? []).filter((t) =>
        FUMERO_TASK_KEYS.has(t.task_key)
      );
      setActiveAutomations(
        fumeroTasks.filter((t) => Boolean(t.enabled)).length
      );
      setBriefingAgeLabel(formatBriefingAge(briefing.generated_at));
      setMonthlyCostEur(
        typeof usage.total_eur === "number" ? usage.total_eur : 0
      );
      setHoursSaved(
        typeof kpi.time_saved?.hours_estimate === "number"
          ? kpi.time_saved.hours_estimate
          : null
      );
    } catch {
      setLibraryCount(null);
      setOpenOrdersCount(null);
      setActiveAutomations(null);
      setBriefingAgeLabel(null);
      setMonthlyCostEur(null);
      setHoursSaved(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    libraryCount,
    activeAutomations,
    openOrdersCount,
    briefingAgeLabel,
    monthlyCostEur,
    hoursSaved,
  };
}
