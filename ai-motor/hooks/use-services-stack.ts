"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServiceStatus } from "@/lib/types";

const initial: ServiceStatus = {
  n8n: false,
  qdrant: false,
  ollama: false,
  dify: false,
};

/**
 * Backend-status voor het dashboard (cookie). Parallel op de server; hier beperken we polls
 * om motorsai niet te laten blokkeren bij elke navigatie-RSC.
 */
export function useServicesStackHealth(pollMs = 55_000) {
  const [status, setStatus] = useState<ServiceStatus>(initial);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await fetch("/api/chat/stack-health", {
        credentials: "include",
        cache: "no-store",
        signal: ac.signal,
      });
      const text = await r.text();
      type HealthJson = {
        services?: ServiceStatus;
        dependencies?: Partial<
          Record<keyof ServiceStatus, { ok?: boolean } | undefined>
        >;
      };
      let j: HealthJson;
      try {
        j = JSON.parse(text) as HealthJson;
      } catch {
        return;
      }
      if (!r.ok) return;
      if (j.services) {
        setStatus(j.services);
      } else {
        const d = j.dependencies ?? {};
        setStatus({
          n8n: !!d.n8n?.ok,
          qdrant: !!d.qdrant?.ok,
          ollama: !!d.ollama?.ok,
          dify: !!d.dify?.ok,
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const runIfVisible = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void refresh();
      }
    };

    runIfVisible();
    const poll = window.setInterval(runIfVisible, pollMs);

    window.addEventListener("focus", runIfVisible);
    document.addEventListener("visibilitychange", runIfVisible);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", runIfVisible);
      document.removeEventListener("visibilitychange", runIfVisible);
      abortRef.current?.abort();
    };
  }, [refresh, pollMs]);

  return { status, loading, refresh };
}
