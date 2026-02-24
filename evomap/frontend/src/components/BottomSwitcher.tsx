"use client";

import { motion } from "framer-motion";

const tabs = [
  { id: "operations", label: "Operations" },
  { id: "marketing",  label: "Marketing" },
  { id: "finance",    label: "Finance" },
] as const;

type TabId = (typeof tabs)[number]["id"];

interface BottomSwitcherProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function BottomSwitcher({ active, onChange }: BottomSwitcherProps) {
  return (
    <nav
      className="relative z-10 flex items-center justify-center py-3"
    >
      <div
        className="inline-flex items-center gap-1 rounded-full p-1 glass"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="relative rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none"
              style={{
                color: isActive ? "var(--color-foreground)" : "var(--color-muted)",
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "var(--color-glass-surface)",
                    border: "1px solid var(--color-glass-border)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 0 12px var(--color-apple-blue) / 0.20",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
