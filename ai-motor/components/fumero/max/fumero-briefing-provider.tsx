"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FumeroBriefingPayload } from "@/lib/fumero/briefing";
import {
  formatMaxOpeningMessage,
  pickBriefingQuickActions,
} from "@/lib/fumero/max-briefing-chat";

type BriefingState = {
  data: FumeroBriefingPayload | null;
  loading: boolean;
  error: string | null;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  quickActions: Array<{ label: string; prompt: string }>;
  openingMessage: string | null;
  registerSendPrompt: (fn: (prompt: string) => void) => void;
  sendFromBriefing: (prompt: string) => void;
};

const FumeroBriefingContext = createContext<BriefingState | null>(null);

export function FumeroBriefingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FumeroBriefingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const sendPromptRef = useRef<(prompt: string) => void>(() => {});

  const registerSendPrompt = useCallback((fn: (prompt: string) => void) => {
    sendPromptRef.current = fn;
  }, []);

  const sendFromBriefing = useCallback((prompt: string) => {
    sendPromptRef.current(prompt);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fumero/briefing", { credentials: "include" });
      const json = (await res.json()) as FumeroBriefingPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Briefing laden mislukt");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Briefing laden mislukt");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const quickActions = useMemo(
    () => (data ? pickBriefingQuickActions(data, 3) : []),
    [data]
  );

  const openingMessage = useMemo(
    () => (data?.summary ? formatMaxOpeningMessage(data) : null),
    [data]
  );

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      panelOpen,
      setPanelOpen,
      refresh,
      quickActions,
      openingMessage,
      registerSendPrompt,
      sendFromBriefing,
    }),
    [
      data,
      loading,
      error,
      panelOpen,
      refresh,
      quickActions,
      openingMessage,
      registerSendPrompt,
      sendFromBriefing,
    ]
  );

  return (
    <FumeroBriefingContext.Provider value={value}>{children}</FumeroBriefingContext.Provider>
  );
}

export function useFumeroBriefing() {
  const ctx = useContext(FumeroBriefingContext);
  if (!ctx) {
    throw new Error("useFumeroBriefing must be used within FumeroBriefingProvider");
  }
  return ctx;
}
