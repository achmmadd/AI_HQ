"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuilderDeviceFrame = "desktop" | "tablet" | "mobile";

const FRAMES: Array<{
  id: BuilderDeviceFrame;
  label: string;
  icon: typeof Monitor;
}> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobiel", icon: Smartphone },
];

export function BuilderDeviceToggle({
  value,
  onChange,
  className,
}: {
  value: BuilderDeviceFrame;
  onChange: (frame: BuilderDeviceFrame) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("builder-device-toggle", className)}
      role="group"
      aria-label="Apparaatweergave"
    >
      {FRAMES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          data-active={value === id ? "true" : undefined}
          className="builder-device-toggle__btn"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function builderDeviceMaxWidth(frame: BuilderDeviceFrame): string | undefined {
  switch (frame) {
    case "mobile":
      return "390px";
    case "tablet":
      return "768px";
    default:
      return undefined;
  }
}
