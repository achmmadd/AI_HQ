"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEvomapSocket } from "@/hooks/useEvomapSocket";
import { AgentCustomNode } from "@/components/AgentCustomNode";
import { Sidebar } from "@/components/Sidebar";
import { MessagesPanel, type ActivityMessage } from "@/components/MessagesPanel";
import { BottomSwitcher } from "@/components/BottomSwitcher";

const nodeTypes = { agent: AgentCustomNode };

type TabId = "operations" | "marketing" | "finance";

function deriveAgents(nodes: Node[]) {
  return nodes.map((n) => ({
    id: n.id,
    name: (n.data?.name as string) ?? n.id,
    current_task: (n.data?.currentTask as string) ?? "",
    status: (n.data?.status as string) ?? "idle",
    updated_at: 0,
  }));
}

let msgCounter = 0;

export default function EvomapPage() {
  const { nodes, setNodes, edges, setEdges, connected } = useEvomapSocket();
  const [activeSection, setActiveSection] = useState("holding");
  const [activeTab, setActiveTab] = useState<TabId>("operations");
  const [messages, setMessages] = useState<ActivityMessage[]>([]);

  // Track previous node statuses to detect changes → activity messages
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = new Map<string, string>();
    const newMsgs: ActivityMessage[] = [];

    nodes.forEach((n) => {
      const status = (n.data?.status as string) ?? "idle";
      const name = (n.data?.name as string) ?? n.id;
      const task = (n.data?.currentTask as string) ?? "";
      next.set(n.id, status);

      const prevStatus = prev.get(n.id);
      if (prevStatus === undefined) {
        // New agent appeared
        newMsgs.push({
          id: `msg-${++msgCounter}`,
          agentName: name,
          text: task || "Agent verbonden",
          status,
          timestamp: Date.now(),
        });
      } else if (prevStatus !== status) {
        // Status changed
        newMsgs.push({
          id: `msg-${++msgCounter}`,
          agentName: name,
          text: task || `Status gewijzigd`,
          status,
          timestamp: Date.now(),
        });
      }
    });

    prevStatusRef.current = next;

    if (newMsgs.length > 0) {
      setMessages((prev) => {
        const combined = [...prev, ...newMsgs];
        // Keep last 80 messages to stay light on NUC RAM
        return combined.length > 80 ? combined.slice(combined.length - 80) : combined;
      });
    }
  }, [nodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const agents = deriveAgents(nodes);

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        height: "100dvh",
        width: "100vw",
        display: "grid",
        gridTemplateAreas: `
          "sidebar canvas  messages"
          "sidebar switcher messages"
        `,
        gridTemplateColumns: "64px 1fr 300px",
        gridTemplateRows: "1fr auto",
        gap: "12px",
        padding: "12px",
        overflow: "hidden",
      }}
    >
      {/* ── Left Sidebar ── */}
      <div style={{ gridArea: "sidebar" }}>
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>

      {/* ── Main Canvas ── */}
      <div
        style={{
          gridArea: "canvas",
          borderRadius: "1.5rem",
          overflow: "hidden",
          position: "relative",
          background: "var(--color-glass-thin)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--color-glass-border-thin)",
        }}
      >
        {/* Canvas header */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1.25rem",
            borderBottom: "1px solid var(--color-glass-border-thin)",
            background: "oklch(100% 0 0 / 0.03)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--color-foreground)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              AI-Holding Evomap
            </h1>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--color-muted)",
                margin: 0,
              }}
            >
              {agents.length} agent{agents.length !== 1 ? "s" : ""} · {activeTab}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: connected
                  ? "var(--color-apple-green)"
                  : "var(--color-apple-red)",
                boxShadow: connected
                  ? "0 0 8px var(--color-apple-green)"
                  : "0 0 8px var(--color-apple-red)",
                display: "inline-block",
              }}
            />
            <span
              style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}
            >
              {connected ? "Live" : "Verbinden…"}
            </span>
          </div>
        </div>

        {/* React Flow canvas */}
        <div style={{ position: "absolute", inset: 0, paddingTop: 52 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.15}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            onlyRenderVisibleElements
            style={{ background: "transparent" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="oklch(100% 0 0 / 0.06)"
            />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const s = (n.data?.status as string) ?? "idle";
                const map: Record<string, string> = {
                  busy:     "oklch(72% 0.18 75)",
                  success:  "oklch(65% 0.17 145)",
                  error:    "oklch(58% 0.20 25)",
                  thinking: "oklch(58% 0.18 295)",
                };
                return map[s] ?? "oklch(55% 0.01 250)";
              }}
              maskColor="oklch(7% 0.02 250 / 0.75)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* ── Right Messages Panel ── */}
      <div style={{ gridArea: "messages", minHeight: 0 }}>
        <MessagesPanel
          messages={messages}
          connected={connected}
          agents={agents}
        />
      </div>

      {/* ── Bottom Switcher ── */}
      <div style={{ gridArea: "switcher" }}>
        <BottomSwitcher
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
      </div>
    </div>
  );
}
