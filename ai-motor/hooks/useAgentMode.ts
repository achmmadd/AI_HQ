"use client";

import { useState, useCallback } from "react";

export interface AgentTask {
  id: string;
  description: string;
  status: "pending" | "running" | "done" | "error";
  result?: string;
  error?: string;
}

export function useAgentMode() {
  const [agentMode, setAgentMode] = useState(false);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [running, setRunning] = useState(false);

  const runAgent = useCallback(async (prompt: string) => {
    const taskId = Date.now().toString();
    const task: AgentTask = {
      id: taskId,
      description: prompt,
      status: "pending",
    };

    setTasks((prev) => [...prev, task]);
    setRunning(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          klant: "system",
          afdeling: "fabriek",
          agent_mode: true,
        }),
      });

      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "done", result: data.message }
            : t
        )
      );
    } catch (error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "error", error: String(error) }
            : t
        )
      );
    } finally {
      setRunning(false);
    }
  }, []);

  return {
    agentMode,
    setAgentMode,
    tasks,
    running,
    runAgent,
  };
}
