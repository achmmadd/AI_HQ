"use client";

import { useEffect, useState } from "react";
import type { AuthRole, WorkspaceScope } from "@/lib/auth-session";

type SessionState = {
  loading: boolean;
  scope: WorkspaceScope | "all";
  role: AuthRole | null;
};

export function useAuthSession() {
  const [state, setState] = useState<SessionState>({
    loading: true,
    scope: "all",
    role: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: { scope?: WorkspaceScope; role?: AuthRole };
        };
        if (cancelled) return;
        if (res.ok && data.authenticated) {
          setState({
            loading: false,
            scope: data.user?.scope ?? "all",
            role: data.user?.role ?? null,
          });
          return;
        }
      } catch {
        // fall through to permissive fallback
      }
      if (!cancelled) {
        setState({ loading: false, scope: "all", role: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
