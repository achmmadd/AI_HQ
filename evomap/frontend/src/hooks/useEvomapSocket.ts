"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Node, Edge } from "@xyflow/react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface EvomapAgent {
  id: string;
  name: string;
  current_task: string;
  status: string;
  updated_at: number;
  parent_id?: string | null;
}

export interface EvomapEdge {
  id: string;
  source: string;
  target: string;
  updated_at?: number;
}

export interface EvomapDelta {
  type: "snapshot" | "agent" | "edge";
  action?: "upsert" | "patch";
  payload?: Record<string, unknown>;
  agents?: EvomapAgent[];
  edges?: EvomapEdge[];
}

function agentToNode(a: EvomapAgent, index: number, isNew = false): Node {
  return {
    id: a.id,
    type: "agent",
    position: { x: 100 + index * 220, y: 100 },
    data: {
      name: a.name,
      currentTask: a.current_task,
      status: a.status,
      parent_id: a.parent_id || undefined,
      isNew,
    },
  };
}

function edgeToFlow(e: EvomapEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
  };
}

export function useEvomapSocket() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const nodesMapRef = useRef<Map<string, Node>>(new Map());
  const edgesMapRef = useRef<Map<string, Edge>>(new Map());

  const applyDelta = useCallback((delta: EvomapDelta) => {
    if (delta.type === "snapshot" && delta.agents && delta.edges) {
      const newNodes = delta.agents.map((a, i) => agentToNode(a, i, false));
      const newEdges = delta.edges.map(edgeToFlow);
      nodesMapRef.current = new Map(newNodes.map((n) => [n.id, n]));
      edgesMapRef.current = new Map(newEdges.map((e) => [e.id, e]));
      setNodes(newNodes);
      setEdges(newEdges);
      return;
    }

    if (delta.type === "agent" && delta.payload) {
      const p = delta.payload as unknown as EvomapAgent & { id: string };
      const existing = nodesMapRef.current.get(p.id);
      const idx = existing
        ? Array.from(nodesMapRef.current.keys()).indexOf(p.id)
        : nodesMapRef.current.size;
      const isNew = !existing;
      const node = agentToNode(
        {
          id: p.id,
          name: p.name ?? (existing?.data?.name as string) ?? "Agent",
          current_task: p.current_task ?? (existing?.data?.currentTask as string) ?? "",
          status: p.status ?? (existing?.data?.status as string) ?? "idle",
          updated_at: (p.updated_at as number) ?? 0,
          parent_id: (p as EvomapAgent).parent_id ?? (existing?.data?.parent_id as string | undefined),
        },
        idx,
        isNew
      );
      node.data = {
        ...node.data,
        name: node.data.name,
        currentTask: node.data.currentTask ?? "",
        status: node.data.status,
        parent_id: (p as EvomapAgent).parent_id ?? undefined,
        isNew,
      };
      nodesMapRef.current.set(p.id, node);
      if (delta.action === "patch" && existing) {
        node.position = existing.position;
      }
      setNodes(Array.from(nodesMapRef.current.values()));
      return;
    }

    if (delta.type === "edge" && delta.payload) {
      const p = delta.payload as unknown as EvomapEdge & { id: string };
      const edge = edgeToFlow({
        id: p.id,
        source: p.source,
        target: p.target,
      });
      edgesMapRef.current.set(p.id, edge);
      setEdges(Array.from(edgesMapRef.current.values()));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;
      const ws = new WebSocket(`${WS_URL}/ws/evomap`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as EvomapDelta;
          applyDelta(data);
        } catch (e) {
          console.warn("Evomap WS parse error:", e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (mounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [applyDelta]);

  return { nodes, setNodes, edges, setEdges, connected };
}
