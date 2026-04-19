"use client";

import { sanitizeCodeForSrcDoc } from "@/lib/builder-code";

export function CustomAppPreview({
  naam,
  slug,
  code,
}: {
  naam: string;
  slug: string;
  code: string;
}) {
  const safe = sanitizeCodeForSrcDoc(code);
  const srcDoc = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  body { margin: 0; background: #0f172a; color: #f1f5f9; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
${safe}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
</script>
</body>
</html>`;

  return (
    <div className="min-h-dvh bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-3">
        <div className="flex items-center gap-3">
          <a
            href="/builder"
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Builder
          </a>
          <span className="text-slate-600">|</span>
          <h1 className="font-medium text-white">{naam}</h1>
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
            live
          </span>
        </div>
        <span className="text-xs text-slate-500">/apps/{slug}</span>
      </div>
      <div className="p-6">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <iframe
            title={naam}
            srcDoc={srcDoc}
            className="h-[min(80vh,720px)] w-full border-0"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}
