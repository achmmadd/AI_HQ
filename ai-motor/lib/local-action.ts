import type { ChatIntent } from "@/lib/intent-detection";
import type { LocalExecutorRequest } from "@/lib/local-executor";
import { isLocalChatEnabled } from "@/lib/chat-routing-policy";

const LOCAL_ACTION_RE =
  /\b(maak bestand|schrijf naar|schrijf bestand|write file|create file|lees bestand|read file|toon map|list dir|ls project|run npm|run npx|voer uit|run command|npm run|npm install|npm test|fix in project|bewerk bestand)\b/i;

const BROWSER_ONLY_RE =
  /\b(open website|bezoek |ga naar |browse|browser|screenshot|navigeer|klik op|inloggen op)\b/i;

/**
 * Lokale NUC-actie (bestand/commando), niet cloud-browser.
 */
export function shouldUseLocalExecutor(
  prompt: string,
  intent: ChatIntent,
  opts?: { agentMode?: boolean }
): boolean {
  if (!opts?.agentMode && !isLocalChatEnabled()) return false;
  const p = prompt.trim();
  if (!p || BROWSER_ONLY_RE.test(p)) return false;
  if (LOCAL_ACTION_RE.test(p)) return true;
  if (intent === "action" && /\b(bestand|file|npm |npx |project)\b/i.test(p)) {
    return true;
  }
  return false;
}

function extractQuoted(s: string): string | null {
  const m = s.match(/["']([^"']+)["']/);
  return m ? m[1] : null;
}

function extractPath(prompt: string): string | null {
  const quoted = extractQuoted(prompt);
  if (quoted && !quoted.includes("\n")) return quoted;
  const patterns = [
    /(?:bestand|file|pad|path)\s+[`']?([^\s`']+\.\w+)/i,
    /(?:in project|project)\s+[`']?([a-zA-Z0-9_./-]+)/i,
    /(?:map|folder)\s+[`']?([a-zA-Z0-9_./-]+)/i,
  ];
  for (const re of patterns) {
    const m = prompt.match(re);
    if (m?.[1]) return m[1].replace(/^\.?\//, "");
  }
  return null;
}

function extractWriteContent(prompt: string): string {
  const afterColon = prompt.split(/:\s*\n?/);
  if (afterColon.length > 1) {
    return afterColon.slice(1).join(": ").trim();
  }
  const inhoud = prompt.match(/inhoud\s*[:=]\s*["']?([^"']+)["']?/i);
  if (inhoud?.[1]) return inhoud[1];
  return "";
}

/**
 * Heuristische parser — geen LLM. Retourneert null als niet parseerbaar.
 */
export function parseLocalActionFromPrompt(
  prompt: string
): LocalExecutorRequest | null {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  if (/\b(lees|read)\b.*\b(bestand|file)\b/i.test(p) || /^lees\s+/i.test(p)) {
    const path = extractPath(p) ?? extractQuoted(p);
    if (path) return { op: "read_file", path };
  }

  if (
    /\b(maak|schrijf|write|create)\b.*\b(bestand|file)\b/i.test(p) ||
    /\bschrijf naar\b/i.test(p)
  ) {
    const path = extractPath(p);
    if (path) {
      const content = extractWriteContent(p);
      return { op: "write_file", path, content: content || "\n" };
    }
  }

  if (/\b(toon map|list dir|ls project|lijst bestanden)\b/i.test(p)) {
    const path = extractPath(p) ?? ".";
    return { op: "list_dir", path };
  }

  const npmMatch = p.match(/\b(npm\s+.+|npx\s+.+|pnpm\s+.+|yarn\s+.+)/i);
  const runMatch = p.match(/\b(?:run|voer uit)\s*[:.]?\s*(.+)$/i);
  const cmdRaw = npmMatch?.[1] ?? runMatch?.[1];
  if (cmdRaw) {
    const command = cmdRaw.replace(/^command\s+/i, "").trim();
    const cwd =
      extractPath(p) ??
      (lower.match(/project\s+([a-z0-9_-]+)/i)?.[1] ?? ".");
    return { op: "run_command", command, cwd };
  }

  return null;
}

export function formatLocalExecutorMessage(
  req: LocalExecutorRequest,
  result: { ok: boolean; data?: Record<string, unknown>; error?: string }
): string {
  const label = describeLocalOp(req);
  if (!result.ok) {
    return `**Actie op NUC:** ${label}\n\n❌ ${result.error ?? "mislukt"}`;
  }
  const d = result.data ?? {};
  const lines: string[] = [`**Actie op NUC:** ${label}`, ""];
  if (req.op === "read_file" && typeof d.content === "string") {
    lines.push("```");
    lines.push(d.content.slice(0, 8000));
    lines.push("```");
    if (d.truncated) lines.push("\n_(bestand ingekort)_");
  } else if (req.op === "write_file") {
    lines.push(`✅ Geschreven: \`${String(d.path ?? req.path)}\` (${String(d.bytes_written ?? "?")} bytes)`);
  } else if (req.op === "list_dir" && Array.isArray(d.entries)) {
    lines.push(d.entries.slice(0, 40).map((e) => `- ${e}`).join("\n"));
    if ((d.entries as string[]).length > 40) {
      lines.push("\n_(meer items weggelaten)_");
    }
  } else if (req.op === "run_command") {
    lines.push(`Exit: ${String(d.exit_code ?? "?")}`);
    if (d.stdout) lines.push("\n**stdout:**\n```\n" + String(d.stdout).slice(0, 4000) + "\n```");
    if (d.stderr) lines.push("\n**stderr:**\n```\n" + String(d.stderr).slice(0, 2000) + "\n```");
  } else {
    lines.push("✅ Uitgevoerd.");
  }
  return lines.join("\n");
}

function describeLocalOp(req: LocalExecutorRequest): string {
  switch (req.op) {
    case "read_file":
      return `lees \`${req.path}\``;
    case "write_file":
      return `schrijf \`${req.path}\``;
    case "list_dir":
      return `map \`${req.path ?? "."}\``;
    case "run_command":
      return `\`${req.command}\` (cwd: ${req.cwd ?? "."})`;
    default:
      return req.op;
  }
}
