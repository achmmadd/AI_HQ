"use client";

import { useEffect, useState } from "react";

type Readiness = {
  agent?: {
    agent_dedicated_webhook_configured?: boolean;
    browserbase_configured?: boolean;
    viewer_url_configured?: boolean;
    local_executor_configured?: boolean;
    local_executor_reachable?: boolean;
    pc_bridge_phase?: number;
  };
  memory?: {
    chat_memory_active?: boolean;
  };
  flags?: {
    agent_mode_question_uses_factory_webhook?: boolean;
  };
  notes?: string[];
};

export type AgentReadinessState = {
  hint: string | null;
  dedicated: boolean;
  factoryFallback: boolean;
  canEnable: boolean;
  blockReason: string | null;
  memoryActive: boolean;
  nucExecutorReady: boolean;
  pcBridgePhase: number | null;
  loading: boolean;
};

function applyReadiness(
  d: Readiness,
  agentMode: boolean
): AgentReadinessState {
  const dedicated = Boolean(d.agent?.agent_dedicated_webhook_configured);
  const factoryFallback = Boolean(
    d.flags?.agent_mode_question_uses_factory_webhook ?? true
  );
  const memoryActive = Boolean(d.memory?.chat_memory_active);
  const nucExecutorReady = Boolean(
    d.agent?.local_executor_configured && d.agent?.local_executor_reachable
  );
  const pcBridgePhase =
    typeof d.agent?.pc_bridge_phase === "number" ? d.agent.pc_bridge_phase : null;
  const canEnable = dedicated || factoryFallback;
  const notes = Array.isArray(d.notes) ? d.notes : [];
  const blockReason = canEnable
    ? null
    : notes[0] ||
      "Agent-modus vereist n8n (N8N_FACTORY_OS_WEBHOOK of N8N_AGENT_WEBHOOK).";

  const executorNote = nucExecutorReady
    ? " NUC executor: actief (bestanden/commando’s op de NUC)."
    : d.agent?.local_executor_configured
      ? " NUC executor: geconfigureerd maar offline."
      : "";

  if (!agentMode) {
    return {
      hint: null,
      dedicated,
      factoryFallback,
      canEnable,
      blockReason,
      memoryActive,
      nucExecutorReady,
      pcBridgePhase,
      loading: false,
    };
  }

  if (dedicated) {
    return {
      dedicated: true,
      factoryFallback,
      canEnable,
      blockReason,
      memoryActive,
      nucExecutorReady,
      pcBridgePhase,
      loading: false,
      hint:
        "Agent-modus: chat via agent-webhook; browsertaken bij actie-opdrachten (langere wachttijd)." +
        executorNote +
        (pcBridgePhase === 2 ? " PC bridge: fase 2 (nog niet gekoppeld)." : ""),
    };
  }

  if (factoryFallback) {
    return {
      dedicated: false,
      factoryFallback: true,
      canEnable: true,
      blockReason: null,
      memoryActive,
      nucExecutorReady,
      pcBridgePhase,
      loading: false,
      hint:
        "Agent-modus: Factory OS met agent_mode. Voor browser: N8N_AGENT_WEBHOOK + browsertaak. Voor bestanden/npm op NUC: agent-modus + duidelijke opdracht." +
        executorNote,
    };
  }

  return {
    dedicated: false,
    factoryFallback: false,
    canEnable: false,
    blockReason,
    memoryActive,
    nucExecutorReady,
    pcBridgePhase,
    loading: false,
    hint: blockReason,
  };
}

export function useAgentReadiness(agentMode: boolean): AgentReadinessState {
  const [state, setState] = useState<AgentReadinessState>({
    hint: null,
    dedicated: false,
    factoryFallback: true,
    canEnable: true,
    blockReason: null,
    memoryActive: false,
    nucExecutorReady: false,
    pcBridgePhase: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    void (async () => {
      try {
        const res = await fetch("/api/admin/integration-readiness", {
          credentials: "include",
        });
        if (!res.ok || cancelled) {
          if (!cancelled) {
            setState((s) => ({
              ...s,
              loading: false,
              hint: agentMode
                ? "Agent-modus aan — kon readiness niet ophalen."
                : null,
            }));
          }
          return;
        }
        const d = (await res.json()) as Readiness;
        if (cancelled) return;
        setState(applyReadiness(d, agentMode));
      } catch {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            hint: agentMode
              ? "Agent-modus aan — kon readiness niet ophalen."
              : null,
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentMode]);

  return state;
}
