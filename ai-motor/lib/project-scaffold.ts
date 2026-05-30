import type { ProjectStack } from "@/lib/project-stack";
import type { ProjectFiles, ProjectSpec } from "@/lib/project-types";

/** Fallback scaffold als LLM faalt — nog steeds multi-file. */
export function defaultProjectScaffold(
  spec: ProjectSpec,
  stack: ProjectStack = spec.stack ?? "vanilla"
): ProjectFiles {
  if (stack === "react" || stack === "next") {
    return defaultReactScaffold(spec, stack);
  }
  const nav = spec.pages
    .map(
      (p, i) =>
        `<button type="button" class="nav-btn${i === 0 ? " active" : ""}" data-page="${escapeAttr(p)}">${escapeHtml(p)}</button>`
    )
    .join("\n        ");

  const sections = spec.pages
    .map(
      (p, i) =>
        `<section class="page${i === 0 ? " active" : ""}" data-page="${escapeAttr(p)}">
          <h2>${escapeHtml(p)}</h2>
          <p class="muted">${escapeHtml(spec.description ?? `Onderdeel van ${spec.title}`)}</p>
          ${spec.features.length ? `<ul class="features">${spec.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
        </section>`
    )
    .join("\n      ");

  return {
    "index.html": `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(spec.title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <h1>${escapeHtml(spec.title)}</h1>
    <p class="tagline">${escapeHtml(spec.klant)} · MotorsAI project</p>
    <nav class="nav">${nav}</nav>
  </header>
  <main class="main">
      ${sections}
  </main>
  <footer class="footer">Gebouwd met MotorsAI</footer>
  <script src="app.js"></script>
</body>
</html>`,
    "styles.css": `:root {
  --bg: #0f1419;
  --surface: #1a2332;
  --text: #e8edf4;
  --muted: #8b9cb3;
  --accent: #3b82f6;
  --radius: 12px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}
.header {
  padding: 1.5rem 1.25rem;
  background: var(--surface);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
.tagline { margin: 0 0 1rem; color: var(--muted); font-size: 0.9rem; }
.nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.nav-btn {
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: var(--text);
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.85rem;
}
.nav-btn.active, .nav-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
}
.main { max-width: 48rem; margin: 0 auto; padding: 1.5rem 1.25rem; }
.page { display: none; }
.page.active { display: block; }
.page h2 { margin-top: 0; }
.muted { color: var(--muted); }
.features { padding-left: 1.25rem; }
.footer {
  text-align: center;
  padding: 2rem;
  color: var(--muted);
  font-size: 0.8rem;
}`,
    "app.js": `document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.getAttribute("data-page");
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".page").forEach((sec) => {
      sec.classList.toggle("active", sec.getAttribute("data-page") === page);
    });
  });
});
`,
  };
}

function defaultReactScaffold(spec: ProjectSpec, stack: ProjectStack): ProjectFiles {
  const title = escapeHtml(spec.title);
  const pageBody =
    stack === "next"
      ? `'use client';\n\nexport default function Page() {\n  return (\n    <main className="page">\n      <h1>${title}</h1>\n      <p>${escapeHtml(spec.description ?? "MotorsAI project")}</p>\n    </main>\n  );\n}`
      : `export default function App() {\n  return (\n    <main className="page">\n      <h1>${title}</h1>\n      <p>${escapeHtml(spec.description ?? "MotorsAI project")}</p>\n    </main>\n  );\n}`;

  if (stack === "next") {
    return {
      "package.json": JSON.stringify(
        { name: spec.title.toLowerCase().replace(/\s+/g, "-"), private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "14.2.0", react: "^18.3.0", "react-dom": "^18.3.0" } },
        null,
        2
      ),
      "app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="nl">\n      <body>{children}</body>\n    </html>\n  );\n}`,
      "app/page.tsx": pageBody,
      "app/globals.css": "body { margin: 0; font-family: system-ui, sans-serif; background: #0a0a0f; color: #f4f4f5; }\n.page { padding: 2rem; max-width: 960px; margin: 0 auto; }",
    };
  }

  return {
    "package.json": JSON.stringify(
      { name: spec.title.toLowerCase().replace(/\s+/g, "-"), private: true, type: "module", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" }, devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.0.0", typescript: "^5.0.0" } },
      null,
      2
    ),
    "index.html": `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    "src/main.tsx": `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')!).render(<App />);`,
    "src/App.tsx": pageBody.replace("'use client';\n\n", ""),
    "src/index.css": "body { margin: 0; font-family: system-ui, sans-serif; background: #0a0a0f; color: #f4f4f5; }\n.page { padding: 2rem; }",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
