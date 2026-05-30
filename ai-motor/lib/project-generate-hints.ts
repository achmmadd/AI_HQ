import type { ProjectStack } from "@/lib/project-stack";

export function filesJsonHint(stack: ProjectStack): string {
  switch (stack) {
    case "next":
      return `Lever ALLEEN JSON (geen markdown):
{"files":{
  "package.json":"...",
  "next.config.mjs":"...",
  "tsconfig.json":"...",
  "app/layout.tsx":"...",
  "app/page.tsx":"...",
  "app/globals.css":"...",
  "components/...":"..."
}}
Regels: Next.js 14 App Router, TypeScript, 'use client' waar nodig, echte componenten (geen placeholder TODO's), NL UI-teksten, productie-kwaliteit code zoals Lovable/Codex.`;
    case "react":
      return `Lever ALLEEN JSON (geen markdown):
{"files":{
  "package.json":"...",
  "vite.config.ts":"...",
  "index.html":"...",
  "src/main.tsx":"...",
  "src/App.tsx":"...",
  "src/index.css":"..."
}}
Regels: React 18 + Vite + TypeScript, function components, hooks waar nodig, geen lege stubs, NL UI-teksten, echte werkende UI.`;
    default:
      return `Lever ALLEEN JSON (geen markdown):
{"files":{"index.html":"...volledig HTML5...","styles.css":"...","app.js":"..."}}
Regels: vanilla JS (geen build-step), geen import/export in app.js, NL UI-teksten, polish zoals een premium webapp.`;
  }
}
