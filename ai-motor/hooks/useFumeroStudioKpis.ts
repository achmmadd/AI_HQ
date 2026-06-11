"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJsonOptional } from "@/lib/fetch-json-client";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";
import {
  formatBriefingAge,
  type FumeroStudioKpis,
} from "@/lib/fumero/studio-kpis";

type AutomationTaskRow = { task_key: string; enabled: number };

const fetchOpts = { credentials: "include" as const };

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
      const [content, orders, tasksJson, briefing, usage, kpi] =
        await Promise.all([
          fetchJsonOptional<{ posts?: unknown[] }>(
            "/api/content?klant=fumero",
            fetchOpts
          ),
          fetchJsonOptional<{ orders?: unknown[] }>(
            "/api/fumero/orders?limit=100",
            fetchOpts
          ),
          fetchJsonOptional<{ tasks?: AutomationTaskRow[] }>(
            "/api/automation/tasks",
            fetchOpts
          ),
          fetchJsonOptional<{ generated_at?: string }>(
            "/api/fumero/briefing",
            fetchOpts
          ),
          fetchJsonOptional<{ total_eur?: number }>(
            "/api/usage/summary?period=month&klant=fumero",
            fetchOpts
          ),
          fetchJsonOptional<{
            time_saved?: { hours_estimate?: number };
          }>("/api/kpi?klant=fumero", fetchOpts),
        ]);

      setLibraryCount(
        Array.isArray(content?.posts) ? content.posts.length : 0
      );
      setOpenOrdersCount(
        Array.isArray(orders?.orders) ? orders.orders.length : 0
      );
      const fumeroTasks = (tasksJson?.tasks ?? []).filter((t) =>
        FUMERO_TASK_KEYS.has(t.task_key)
      );
      setActiveAutomations(
        fumeroTasks.filter((t) => Boolean(t.enabled)).length
      );
      setBriefingAgeLabel(formatBriefingAge(briefing?.generated_at));
      setMonthlyCostEur(
        typeof usage?.total_eur === "number" ? usage.total_eur : 0
      );
      setHoursSaved(
        typeof kpi?.time_saved?.hours_estimate === "number"
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
