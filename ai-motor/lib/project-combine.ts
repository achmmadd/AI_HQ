import type { ProjectFiles } from "@/lib/project-types";

const DEFAULT_INDEX = "index.html";

/** Combineer multi-file project tot één HTML-document voor iframe srcDoc. */
export function combineProjectFilesToHtml(files: ProjectFiles): string {
  const keys = Object.keys(files);
  if (keys.length === 0) {
    return "<!DOCTYPE html><html><body><p>Leeg project</p></body></html>";
  }

  let html =
    files[DEFAULT_INDEX] ??
    files["public/index.html"] ??
    Object.entries(files).find(([k]) => k.endsWith(".html"))?.[1] ??
    "";

  const css =
    files["styles.css"] ??
    files["public/styles.css"] ??
    Object.entries(files).find(([k]) => k.endsWith(".css"))?.[1];
  const js =
    files["app.js"] ??
    files["public/app.js"] ??
    Object.entries(files).find(([k]) => k.endsWith(".js"))?.[1];

  if (!html.trim()) {
    html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project</title></head>
<body><div id="app"></div></body></html>`;
  }

  if (css?.trim()) {
    if (html.includes("</head>")) {
      html = html.replace(
        "</head>",
        `<style>\n${css}\n</style>\n</head>`
      );
    } else {
      html = html.replace("<body", `<head><style>\n${css}\n</style></head><body`);
    }
  }

  if (js?.trim()) {
    const scriptTag = `<script>\n${js}\n</script>`;
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${scriptTag}\n</body>`);
    } else {
      html += scriptTag;
    }
  }

  if (!/<!DOCTYPE/i.test(html)) {
    html = `<!DOCTYPE html>\n${html}`;
  }

  return html;
}
