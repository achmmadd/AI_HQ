#!/usr/bin/env node
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(process.env.HOME || "/home/pietje", "AI_HQ", "data", "ai-motor.db");

function fixCss(code) {
  let c = code;
  c = c.replace(/^\s*,\s*::before,\s*::after\s*\{/m, "*, ::before, ::after {");
  c = c.replace(/^(\s*)\/\s*(.+?)\s*\/?\s*$/gm, (match, indent, label) => {
    if (!match.includes("*/") && !match.trim().startsWith("/*")) {
      return `${indent}/* ${label.replace(/\*+$/, "").trim()} */`;
    }
    return match;
  });
  c = c.replace(
    /\.panel\.active \{\s*display: flex;\s*\}/,
    ".panel.active {\n      display: flex;\n      flex-direction: column;\n    }"
  );
  const extraCss = `
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #C5E88A;
      color: #fff;
    }
    .btn-primary:disabled:hover {
      background: #C5E88A;
    }
    #panel-1 .btn-row {
      margin-top: 4px;
      width: 100%;
    }
    #panel-1 .product-grid {
      width: 100%;
    }
  `;
  if (!c.includes(".btn-primary:disabled")) {
    c = c.replace("</style>", `${extraCss}\n  </style>`);
  }
  return c;
}

function patchHtml(code) {
  let c = fixCss(code);
  const marker = 'id="btn-submit"';
  if (!c.includes(marker)) throw new Error("btn-submit marker not found");
  if (c.includes("function goToStep")) {
    c = fixCss(c);
    const scriptStart = c.indexOf("<script>");
    const scriptEnd = c.lastIndexOf("</script>");
    if (scriptStart === -1) throw new Error("script block missing");
    const completion = fs.readFileSync(
      path.join(__dirname, "offerte-widget-v31-completion.html"),
      "utf8"
    );
    const newScript = completion.slice(
      completion.indexOf("<script>"),
      completion.lastIndexOf("</script>") + "</script>".length
    );
    return fixCss(c.slice(0, scriptStart) + newScript + "\n</body>\n</html>");
  }
  const legacyMarker = '<button class="btn btn-primary" id="btn-submit">';
  const idx = c.indexOf(legacyMarker);
  if (idx === -1) throw new Error("btn-submit button not found");
  const head = c.slice(0, idx);
  const completion = fs.readFileSync(
    path.join(__dirname, "offerte-widget-v31-completion.html"),
    "utf8"
  );
  const submitBtn =
    '<button class="btn btn-primary" id="btn-submit" type="button">\n        Aanvraag versturen\n        ';
  return head + submitBtn + completion;
}

const db = new Database(DB_PATH);
const row = db.prepare("SELECT code, tool_id FROM fumero_tool_versions WHERE id = 31").get();
if (!row) {
  console.error("version 31 missing");
  process.exit(1);
}
const fixed = patchHtml(row.code);
if (!fixed.includes("</script>") || !fixed.includes("goToStep")) {
  console.error("patch validation failed");
  process.exit(1);
}
db.prepare("UPDATE fumero_tool_versions SET code = ? WHERE id = 31").run(fixed);
db.prepare("UPDATE fumero_tools SET updated_at = datetime('now') WHERE id = ?").run(row.tool_id);
console.log("Patched v31:", fixed.length, "bytes");
db.close();
