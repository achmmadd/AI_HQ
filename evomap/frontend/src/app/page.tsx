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
type SectionId = "holding" | "swarm" | "security" | "logs";

// Welke statuses tellen als "actief"
const ACTIVE_STATUSES = new Set(["busy", "thinking", "error"]);

// Tab → zoekwoorden in agent naam of taak
const TAB_KEYWORDS: Record<TabId, string[]> = {
  operations: [],
  marketing: ["market", "seo", "content", "copy", "visual", "trend", "viral", "brand"],
  finance: ["finance", "cost", "budget", "revenue", "invoice", "billing"],
};

function deriveAgents(nodes: Node[]) {
  return nodes.map((n) => ({
    id: n.id,
    name: (n.data?.name as string) ?? n.id,
    current_task: (n.data?.currentTask as string) ?? "",
    status: (n.data?.status as string) ?? "idle",
    updated_at: 0,
  }));
}

function matchesTab(node: Node, tab: TabId): boolean {
  if (tab === "operations") return true;
  const kws = TAB_KEYWORDS[tab];
  const name = ((node.data?.name as string) ?? node.id).toLowerCase();
  const task = ((node.data?.currentTask as string) ?? "").toLowerCase();
  return kws.some((kw) => name.includes(kw) || task.includes(kw));
}

let msgCounter = 0;

// ── Security Panel ──────────────────────────────────────
function SecurityPanel({ nodes }: { nodes: Node[] }) {
  const agents = deriveAgents(nodes);
  const errors = agents.filter((a) => a.status === "error");
  const active = agents.filter((a) => ACTIVE_STATUSES.has(a.status));
  const healthy = agents.length - errors.length;

  const rows: { label: string; value: string; color: string }[] = [
    { label: "Totaal agents", value: String(agents.length), color: "var(--color-foreground)" },
    { label: "Actief", value: String(active.length), color: "var(--color-apple-amber)" },
    { label: "Gezond", value: String(healthy), color: "var(--color-apple-green)" },
    { label: "Fout", value: String(errors.length), color: errors.length > 0 ? "var(--color-apple-red)" : "var(--color-muted)" },
  ];

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--color-foreground)" }}>
        Security & Health
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {rows.map((r) => (
          <div key={r.label} style={{
            background: "var(--color-glass-surface)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--color-glass-border)",
            borderRadius: "1rem",
            padding: "1rem 1.25rem",
          }}>
            <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginBottom: "0.375rem" }}>{r.label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: r.color, fontVariantNumeric: "tabular-nums" }}>{r.value}</div>
          </div>
        ))}
      </div>
      {errors.length > 0 && (
        <div style={{ background: "oklch(58% 0.20 25 / 0.12)", border: "1px solid oklch(58% 0.20 25 / 0.30)", borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-apple-red)", marginBottom: "0.5rem" }}>Agents met fout</div>
          {errors.map((a) => (
            <div key={a.id} style={{ fontSize: "0.8125rem", color: "var(--color-muted)", paddingLeft: "0.5rem" }}>
              • {a.name} — {a.current_task || "geen taak"}
            </div>
          ))}
        </div>
      )}
      {errors.length === 0 && (
        <div style={{ background: "oklch(65% 0.17 145 / 0.10)", border: "1px solid oklch(65% 0.17 145 / 0.25)", borderRadius: "0.875rem", padding: "0.875rem 1rem", fontSize: "0.875rem", color: "var(--color-apple-green)" }}>
          Alle agents operationeel
        </div>
      )}
    </div>
  );
}

// ── Logs Panel ───────────────────────────────────────────
function LogsPanel({ messages }: { messages: ActivityMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const statusColor: Record<string, string> = {
    busy: "var(--color-apple-amber)",
    thinking: "var(--color-apple-purple)",
    success: "var(--color-apple-green)",
    error: "var(--color-apple-red)",
    idle: "var(--color-muted)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "1.25rem" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-foreground)" }}>
        System Logs
      </h2>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: "0.75rem",
          scrollbarWidth: "thin",
          scrollbarColor: "oklch(100% 0 0 / 0.15) transparent",
        }}
      >
        {messages.length === 0 ? (
          <span style={{ color: "var(--color-muted)" }}>Wacht op activiteit…</span>
        ) : (
          messages.map((m) => {
            const color = statusColor[m.status] ?? "var(--color-muted)";
            const t = new Date(m.timestamp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            return (
              <div key={m.id} style={{ display: "flex", gap: "0.75rem", alignItems: "baseline" }}>
                <span style={{ color: "var(--color-muted)", flexShrink: 0, opacity: 0.6 }}>{t}</span>
                <span style={{ color, flexShrink: 0 }}>[{m.agentName}]</span>
                <span style={{ color: "var(--color-foreground)", opacity: 0.8 }}>{m.text || m.status}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function EvomapPage() {
  const { nodes, setNodes, edges, setEdges, connected } = useEvomapSocket();
  const [activeSection, setActiveSection] = useState<SectionId>("holding");
  const [activeTab, setActiveTab] = useState<TabId>("operations");
  const [messages, setMessages] = useState<ActivityMessage[]>([]);

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
        newMsgs.push({ id: `msg-${++msgCounter}`, agentName: name, text: task || "Agent verbonden", status, timestamp: Date.now() });
      } else if (prevStatus !== status) {
        newMsgs.push({ id: `msg-${++msgCounter}`, agentName: name, text: task || "Status gewijzigd", status, timestamp: Date.now() });
      }
    });

    prevStatusRef.current = next;

    if (newMsgs.length > 0) {
      setMessages((prev) => {
        const combined = [...prev, ...newMsgs];
        return combined.length > 80 ? combined.slice(combined.length - 80) : combined;
      });
    }
  }, [nodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const agents = deriveAgents(nodes);

  // Filter nodes based on active section + tab
  const visibleNodes = nodes.filter((n) => {
    const tabMatch = matchesTab(n, activeTab);
    if (!tabMatch) return false;
    if (activeSection === "swarm") {
      return ACTIVE_STATUSES.has((n.data?.status as string) ?? "idle");
    }
    return true;
  });

  // Only show edges where both endpoints are visible
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
  );

  const sectionLabels: Record<SectionId, string> = {
    holding: "AI-Holding Evomap",
    swarm:   "Actieve Swarm",
    security: "Security & Health",
    logs:    "System Logs",
  };

  const showFlow = activeSection === "holding" || activeSection === "swarm";

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
        <Sidebar activeSection={activeSection} onSectionChange={(id) => setActiveSection(id as SectionId)} />
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
            <h1 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-foreground)", margin: 0, letterSpacing: "-0.01em" }}>
              {sectionLabels[activeSection]}
            </h1>
            <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", margin: 0 }}>
              {showFlow
                ? `${visibleNodes.length} agent${visibleNodes.length !== 1 ? "s" : ""} · ${activeTab}`
                : activeSection === "security"
                ? `${agents.filter((a) => a.status !== "idle").length} actief · ${agents.filter((a) => a.status === "error").length} fout`
                : `${messages.length} log-regels`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", display: "inline-block",
              backgroundColor: connected ? "var(--color-apple-green)" : "var(--color-apple-red)",
              boxShadow: connected ? "0 0 8px var(--color-apple-green)" : "0 0 8px var(--color-apple-red)",
            }} />
            <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
              {connected ? "Live" : "Verbinden…"}
            </span>
          </div>
        </div>

        {/* Canvas body */}
        <div style={{ position: "absolute", inset: 0, paddingTop: 52, overflow: "hidden" }}>
          {showFlow && (
            <ReactFlow
              nodes={visibleNodes}
              edges={visibleEdges}
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
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="oklch(100% 0 0 / 0.06)" />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const s = (n.data?.status as string) ?? "idle";
                  const map: Record<string, string> = {
                    busy: "oklch(72% 0.18 75)", success: "oklch(65% 0.17 145)",
                    error: "oklch(58% 0.20 25)", thinking: "oklch(58% 0.18 295)",
                  };
                  return map[s] ?? "oklch(55% 0.01 250)";
                }}
                maskColor="oklch(7% 0.02 250 / 0.75)"
              />
            </ReactFlow>
          )}

          {activeSection === "security" && (
            <div style={{ height: "100%", overflowY: "auto" }}>
              <SecurityPanel nodes={nodes} />
            </div>
          )}

          {activeSection === "logs" && (
            <LogsPanel messages={messages} />
          )}
        </div>
      </div>

      {/* ── Right Messages Panel ── */}
      <div style={{ gridArea: "messages", minHeight: 0 }}>
        <MessagesPanel messages={messages} connected={connected} agents={agents} />
      </div>

      {/* ── Bottom Switcher ── */}
      <div style={{ gridArea: "switcher" }}>
        <BottomSwitcher active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      </div>
    </div>
  );
}
