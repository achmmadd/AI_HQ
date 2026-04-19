"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceStatus } from "@/lib/types";

const initial: ServiceStatus = {
  n8n: false,
  qdrant: false,
  ollama: false,
  dify: false,
};

export function useServices(pollMs = 15000) {
  const [status, setStatus] = useState<ServiceStatus>(initial);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      const j = (await r.json()) as ServiceStatus & {
        services?: ServiceStatus;
      };
      if (j.services) {
        setStatus(j.services);
      } else {
        setStatus({
          n8n: !!j.n8n,
          qdrant: !!j.qdrant,
          ollama: !!j.ollama,
          dify: !!j.dify,
        });
      }
    } catch {
      setStatus(initial);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, pollMs);
    queueMicrotask(() => {
      void refresh();
    });
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { status, loading, refresh };
}
