import fs from "fs/promises";
import { resolveFileAbs, buildFileTree, type CodeTreeNode } from "@/lib/code-workspace";

export type CodeSelectionContext = {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

const MENTION_RE = /@([^\s@]+)/g;

export function extractMentionPaths(message: string): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const m of message.matchAll(MENTION_RE)) {
    const p = m[1]?.trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      paths.push(p);
    }
  }
  return paths;
}

function flattenTree(nodes: CodeTreeNode[], prefix = ""): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    const p = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.type === "file") out.push(p);
    else if (n.children) out.push(...flattenTree(n.children, p));
  }
  return out;
}

async function expandFolderMention(
  klant: string,
  project: string,
  folderPath: string
): Promise<string[]> {
  const tree = await buildFileTree(klant, project);
  const all = flattenTree(tree);
  const norm = folderPath.replace(/\/$/, "");
  return all.filter(
    (f) => f === norm || f.startsWith(`${norm}/`)
  );
}

export async function enrichCodeAgentMessage(opts: {
  klant: string;
  project: string;
  message: string;
  selection?: CodeSelectionContext | null;
  terminalOutput?: string | null;
}): Promise<string> {
  let enriched = opts.message.trim();

  if (opts.terminalOutput?.trim()) {
    enriched += `\n\n--- Terminal output ---\n\`\`\`\n${opts.terminalOutput.trim().slice(-4000)}\n\`\`\``;
  }

  if (opts.selection?.text.trim()) {
    const { path: filePath, startLine, endLine, text } = opts.selection;
    enriched += `\n\n--- Geselecteerde code (${filePath}:${startLine}-${endLine}) ---\n\`\`\`\n${text}\n\`\`\``;
  }

  const mentions = extractMentionPaths(opts.message);
  const filesToInline: string[] = [];
  for (const mention of mentions.slice(0, 8)) {
    if (mention === "terminal") continue;
    if (mention.endsWith("/") || mention.includes("/") && !mention.includes(".")) {
      const expanded = await expandFolderMention(opts.klant, opts.project, mention.replace(/\/$/, ""));
      filesToInline.push(...expanded.slice(0, 10));
    } else {
      filesToInline.push(mention);
    }
  }

  const seen = new Set<string>();
  let totalChars = 0;
  for (const filePath of filesToInline) {
    if (seen.has(filePath) || totalChars > 12000) continue;
    seen.add(filePath);
    try {
      const abs = resolveFileAbs(opts.klant, opts.project, filePath);
      const content = await fs.readFile(abs, "utf-8");
      const slice = content.slice(0, 4000);
      totalChars += slice.length;
      enriched += `\n\n--- @${filePath} ---\n${slice}`;
    } catch {
      enriched += `\n\n--- @${filePath} ---\n(bestand niet gevonden)`;
    }
  }

  return enriched;
}
