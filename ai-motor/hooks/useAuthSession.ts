"use client";

import { useEffect, useState } from "react";
import type { WorkspaceScope } from "@/lib/auth-session";

type SessionState = {
  loading: boolean;
  scope: WorkspaceScope | "all";
};

export function useAuthSession() {
  const [state, setState] = useState<SessionState>({
    loading: true,
    scope: "all",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: { scope?: WorkspaceScope };
        };
        if (cancelled) return;
        if (res.ok && data.authenticated) {
          setState({
            loading: false,
            scope: data.user?.scope ?? "all",
          });
          return;
        }
      } catch {
        // fall through to permissive fallback
      }
      if (!cancelled) {
        setState({ loading: false, scope: "all" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
