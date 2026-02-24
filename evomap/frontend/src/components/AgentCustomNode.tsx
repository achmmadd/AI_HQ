"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const statusConfig: Record<string, { color: string; label: string; glowColor: string }> = {
  idle: {
    color: "var(--color-muted)",
    label: "Inactief",
    glowColor: "transparent",
  },
  busy: {
    color: "var(--color-apple-amber)",
    label: "Bezig",
    glowColor: "oklch(72% 0.18 75)",
  },
  success: {
    color: "var(--color-apple-green)",
    label: "Klaar",
    glowColor: "oklch(65% 0.17 145)",
  },
  error: {
    color: "var(--color-apple-red)",
    label: "Fout",
    glowColor: "oklch(58% 0.20 25)",
  },
  thinking: {
    color: "var(--color-apple-purple)",
    label: "Denkt…",
    glowColor: "oklch(58% 0.18 295)",
  },
};

const isAnimatedStatus = (status: string) =>
  status === "busy" || status === "thinking";

export const AgentCustomNode = memo(function AgentCustomNode({
  data,
  selected,
}: NodeProps) {
  const name = (data?.name as string) ?? "Agent";
  const currentTask = (data?.currentTask as string) ?? "";
  const status = (data?.status as string) ?? "idle";
  const isNew = (data?.isNew as boolean) ?? false;
  const cfg = statusConfig[status] ?? statusConfig.idle;
  const initials = name.slice(0, 2).toUpperCase();
  const animated = isAnimatedStatus(status);

  const boxShadow = selected
    ? `0 0 0 2px var(--color-apple-blue), 0 0 24px ${cfg.glowColor} / 0.45`
    : animated
    ? `0 8px 32px oklch(0% 0 0 / 0.35), 0 0 24px ${cfg.glowColor} / 0.35`
    : "0 8px 32px oklch(0% 0 0 / 0.35)";

  return (
    <motion.div
      style={{ position: "relative", willChange: "transform" }}
      initial={isNew ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Breathing ambient glow — GPU animated, only when active */}
      {animated && (
        <motion.div
          aria-hidden
          animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.90, 1.08, 0.90] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: "-14px",
            borderRadius: "2.25rem",
            background: cfg.glowColor,
            opacity: 0.18,
            filter: "blur(18px)",
            pointerEvents: "none",
            willChange: "opacity, transform",
          }}
        />
      )}

      {/* Node card */}
      <div
        style={{
          minWidth: 200,
          borderRadius: "1.5rem",
          background: "var(--color-glass-surface)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${selected ? "var(--color-apple-blue)" : "var(--color-glass-border)"}`,
          boxShadow,
          padding: "1rem",
          position: "relative",
          overflow: "hidden",
          transition: "border-color 0.25s, box-shadow 0.25s",
        }}
      >
        {/* Top-edge light refraction */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "38%",
            background:
              "linear-gradient(180deg, oklch(100% 0 0 / 0.09) 0%, transparent 100%)",
            borderRadius: "1.5rem 1.5rem 0 0",
            pointerEvents: "none",
          }}
        />

        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: cfg.color,
            border: "2px solid var(--color-glass-border)",
            width: 8,
            height: 8,
          }}
        />

        {/* Avatar + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "0.625rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              flexShrink: 0,
              background: `color-mix(in oklch, ${cfg.color} 18%, transparent)`,
              border: `1px solid color-mix(in oklch, ${cfg.color} 35%, transparent)`,
              color: cfg.color,
            }}
          >
            {initials}
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "var(--color-foreground)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              minWidth: 0,
            }}
          >
            {name}
          </div>
        </div>

        {/* Current task */}
        {currentTask && (
          <div
            title={currentTask}
            style={{
              fontSize: "0.75rem",
              color: "var(--color-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: "0.625rem",
            }}
          >
            {currentTask}
          </div>
        )}

        {/* Status badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            borderRadius: "9999px",
            padding: "0.25rem 0.625rem",
            fontSize: "0.7rem",
            fontWeight: 500,
            background: `color-mix(in oklch, ${cfg.color} 15%, transparent)`,
            color: cfg.color,
          }}
        >
          <motion.span
            animate={animated ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
            transition={
              animated
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : undefined
            }
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: cfg.color,
              display: "block",
              willChange: "opacity",
            }}
          />
          {cfg.label}
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: cfg.color,
            border: "2px solid var(--color-glass-border)",
            width: 8,
            height: 8,
          }}
        />
      </div>
    </motion.div>
  );
});
