import type { WorkspaceId } from "@/lib/types";

export interface WorkspaceTheme {
  accent: string;
  accentHover: string;
  accentLt: string;
  yellow?: string;
  black?: string;
  white?: string;
  name: string;
  font: string;
  agentName: string;
  agentCharacter: "ghost" | "bokas" | "motor";
}

export const WORKSPACE_THEMES: Record<WorkspaceId, WorkspaceTheme> = {
  fumero: {
    accent: "#69C400",
    accentHover: "#559900",
    accentLt: "rgba(105,196,0,0.08)",
    yellow: "#FEB601",
    black: "#080808",
    white: "#FFFFFF",
    name: "Fumero Studio",
    font: "var(--font-geist), 'Geist', sans-serif",
    agentName: "Smokey",
    agentCharacter: "ghost",
  },
  personal: {
    accent: "#6366F1",
    accentHover: "#4F46E5",
    accentLt: "rgba(99,102,241,0.08)",
    name: "MotorsAI",
    font: "var(--font-geist), 'Geist', sans-serif",
    agentName: "OpenClaw",
    agentCharacter: "motor",
  },
  bokas: {
    accent: "#0EA5E9",
    accentHover: "#0284C7",
    accentLt: "rgba(14,165,233,0.08)",
    name: "Bokas",
    font: "inherit",
    agentName: "Bas",
    agentCharacter: "bokas",
  },
};

export function getWorkspaceTheme(ws: WorkspaceId): WorkspaceTheme {
  return WORKSPACE_THEMES[ws] ?? WORKSPACE_THEMES.personal;
}

export function applyWorkspaceToDocument(ws: WorkspaceId): void {
  if (typeof document === "undefined") return;
  const theme = getWorkspaceTheme(ws);
  const root = document.documentElement;
  root.setAttribute("data-workspace", ws);
  root.style.setProperty("--ws-accent", theme.accent);
  root.style.setProperty("--ws-accent-hover", theme.accentHover);
  root.style.setProperty("--ws-accent-lt", theme.accentLt);
  root.style.setProperty("--ws-font", theme.font);
  root.style.setProperty("--ws-name", `"${theme.name}"`);
  if (theme.yellow) {
    root.style.setProperty("--ws-yellow", theme.yellow);
  } else {
    root.style.removeProperty("--ws-yellow");
  }
  if (theme.black) {
    root.style.setProperty("--ws-black", theme.black);
  } else {
    root.style.removeProperty("--ws-black");
  }
  if (theme.white) {
    root.style.setProperty("--ws-white", theme.white);
  } else {
    root.style.removeProperty("--ws-white");
  }
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-hover", theme.accentHover);
}

export function workspaceFromPathname(pathname: string): WorkspaceId | null {
  if (pathname.startsWith("/fumero")) return "fumero";
  if (pathname.startsWith("/bokas")) return "bokas";
  if (
    pathname === "/chat" ||
    pathname.startsWith("/code") ||
    pathname.startsWith("/agenda") ||
    pathname.startsWith("/todo") ||
    pathname.startsWith("/apps")
  ) {
    return "personal";
  }
  return null;
}
