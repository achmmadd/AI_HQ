import type { ProjectSpec, ProjectStack } from "@/lib/project-types";

export type { ProjectStack } from "@/lib/project-types";

const NEXT_RE =
  /\b(next\.?js|nextjs|app\s*router|server\s*component|api\s*route|layout\.tsx|page\.tsx)\b/i;
const REACT_RE =
  /\b(react|tsx|jsx|vite|component|usestate|useeffect|typescript|\.tsx\b|hooks)\b/i;
const MOTOR_RE = /\b(motor\s*ai|motorsai|factory\s*os|openclaw)\b/i;

export function detectProjectStack(
  prompt: string,
  spec?: Pick<ProjectSpec, "features" | "pages" | "description">
): ProjectStack {
  const t = prompt.trim();
  if (NEXT_RE.test(t) || MOTOR_RE.test(t)) return "next";
  if (REACT_RE.test(t)) return "react";

  const blob = [
    spec?.description ?? "",
    ...(spec?.features ?? []),
    ...(spec?.pages ?? []),
  ]
    .join(" ")
    .toLowerCase();
  if (NEXT_RE.test(blob) || MOTOR_RE.test(blob)) return "next";
  if (REACT_RE.test(blob)) return "react";
  if ((spec?.pages?.length ?? 0) > 4) return "react";
  if (
    spec?.features?.some((f) =>
      /\b(api|database|auth|typescript|deploy)\b/i.test(f)
    )
  ) {
    return "react";
  }
  return "vanilla";
}

export function stackDisplayName(stack: ProjectStack): string {
  switch (stack) {
    case "next":
      return "Next.js";
    case "react":
      return "React + Vite";
    default:
      return "HTML/JS";
  }
}

export function projectHasEntry(files: Record<string, string>, stack: ProjectStack): boolean {
  if (stack === "next") {
    return Boolean(
      files["app/page.tsx"] ||
        files["app/page.jsx"] ||
        files["pages/index.tsx"] ||
        files["index.html"]
    );
  }
  if (stack === "react") {
    return Boolean(
      files["src/App.tsx"] ||
        files["src/App.jsx"] ||
        files["src/main.tsx"] ||
        files["index.html"]
    );
  }
  return Boolean(files["index.html"]);
}
