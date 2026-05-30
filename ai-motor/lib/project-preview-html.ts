import type { ProjectFiles } from "@/lib/project-types";
import type { ProjectStack } from "@/lib/project-stack";
import { combineProjectFilesToHtml } from "@/lib/project-combine";

function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, "<\\/script");
}

function pickFile(files: ProjectFiles, candidates: string[]): string {
  for (const c of candidates) {
    if (files[c]?.trim()) return files[c];
  }
  const lower = Object.fromEntries(
    Object.entries(files).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const c of candidates) {
    const v = lower[c.toLowerCase()];
    if (v?.trim()) return v;
  }
  return "";
}

function collectCss(files: ProjectFiles): string {
  const chunks: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith(".css") && content.trim()) chunks.push(`/* ${path} */\n${content}`);
  }
  return chunks.join("\n\n");
}

function stripModuleSyntax(source: string): string {
  return source
    .replace(/^['"]use client['"];?\s*/gm, "")
    .replace(/^import\s+.+$/gm, "")
    .replace(/export\s+default\s+/g, "")
    .trim();
}

function reactPreviewShell(css: string, userCode: string, note?: string): string {
  const noteHtml = note
    ? `<p style="font:12px system-ui;color:#888;padding:8px 12px;margin:0">${note}</p>`
    : "";
  const rootOpen = "<" + "div id=\"root\"></" + "div>";
  return [
    "<!DOCTYPE html>",
    '<html lang="nl">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width,initial-scale=1">',
    "  <title>MotorsAI preview</title>",
    '  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>',
    '  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>',
    '  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>',
    `  <style>${escapeScript(css)}</style>`,
    "</head>",
    "<body>",
    "  " + rootOpen,
    noteHtml,
    '  <script type="text/babel" data-presets="react,typescript">',
    escapeScript(userCode),
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}

function buildReactPreviewHtml(files: ProjectFiles): string {
  const appSource = pickFile(files, [
    "src/App.tsx",
    "src/App.jsx",
    "src/app.tsx",
    "App.tsx",
  ]);
  const css = collectCss(files);
  const componentBody = stripModuleSyntax(appSource);
  const exportDefaultFn = /function\s+(\w+)\s*\(/.exec(appSource);
  const rootName = exportDefaultFn?.[1] ?? "App";

  if (!componentBody) {
    return combineProjectFilesToHtml(files);
  }

  const userCode = [
    "const { useState, useEffect, useCallback, useMemo, useRef } = React;",
    componentBody,
    "const root = ReactDOM.createRoot(document.getElementById('root'));",
    `root.render(React.createElement(${rootName}));`,
  ].join("\n");

  return reactPreviewShell(css, userCode);
}

function buildNextPreviewHtml(files: ProjectFiles): string {
  const page = pickFile(files, ["app/page.tsx", "app/page.jsx", "pages/index.tsx"]);
  const css = collectCss(files);
  const body = stripModuleSyntax(page);

  if (!body.trim()) {
    return combineProjectFilesToHtml(files);
  }

  const fnMatch = /function\s+(\w+)\s*\(/.exec(body);
  const name = fnMatch?.[1] ?? "Page";

  const userCode = [
    "const { useState, useEffect } = React;",
    body,
    "const root = ReactDOM.createRoot(document.getElementById('root'));",
    `root.render(React.createElement(${name}));`,
  ].join("\n");

  return reactPreviewShell(
    css,
    userCode,
    "Preview · volledige Next-app: npm install && npm run dev"
  );
}

export function buildProjectPreviewHtml(
  files: ProjectFiles,
  stack: ProjectStack = "vanilla"
): string {
  if (stack === "react") return buildReactPreviewHtml(files);
  if (stack === "next") return buildNextPreviewHtml(files);
  return combineProjectFilesToHtml(files);
}
