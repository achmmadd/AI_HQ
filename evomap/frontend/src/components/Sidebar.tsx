"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Network, Shield, ScrollText, Zap } from "lucide-react";

const navItems = [
  { id: "holding",  icon: Bot,        label: "Holding",  color: "var(--color-apple-blue)" },
  { id: "swarm",    icon: Network,    label: "Swarm",    color: "var(--color-apple-purple)" },
  { id: "security", icon: Shield,     label: "Security", color: "var(--color-apple-green)" },
  { id: "logs",     icon: ScrollText, label: "Logs",     color: "var(--color-apple-amber)" },
] as const;

interface SidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside className="relative z-10 flex flex-col items-center gap-3 py-5 px-2">
      {/* Logo mark */}
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl glass glow-blue">
        <Zap size={20} style={{ color: "var(--color-apple-blue)" }} />
      </div>

      <div className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200"
              style={{
                background: isActive ? `${item.color.replace(")", " / 0.18)").replace("oklch(", "oklch(")}` : "var(--color-glass-thin)",
                border: `1px solid ${isActive ? item.color.replace(")", " / 0.35)").replace("oklch(", "oklch(") : "var(--color-glass-border-thin)"}`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: isActive ? `0 0 16px ${item.color.replace(")", " / 0.30)").replace("oklch(", "oklch(")}` : "none",
              }}
              title={item.label}
            >
              <Icon
                size={18}
                style={{ color: isActive ? item.color : "var(--color-muted)" }}
                className="transition-colors duration-200 group-hover:opacity-100"
              />

              {/* Tooltip */}
              <span
                className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100 glass"
                style={{ color: "var(--color-foreground)" }}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Connection status dot at bottom */}
      <div className="mt-auto" />
    </aside>
  );
}
