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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [contentRes, ordersRes, tasksRes, briefingRes] = await Promise.all([
        fetch("/api/content?klant=fumero", { credentials: "include" }),
        fetch("/api/fumero/orders?limit=100", { credentials: "include" }),
        fetch("/api/automation/tasks", { credentials: "include" }),
        fetch("/api/fumero/briefing", { credentials: "include" }),
      ]);

      const content = (await contentRes.json()) as { posts?: unknown[] };
      const orders = (await ordersRes.json()) as { orders?: unknown[] };
      const tasksJson = (await tasksRes.json()) as { tasks?: AutomationTaskRow[] };
      const briefing = (await briefingRes.json()) as { generated_at?: string };

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
    } catch {
      setLibraryCount(null);
      setOpenOrdersCount(null);
      setActiveAutomations(null);
      setBriefingAgeLabel(null);
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
  };
}
