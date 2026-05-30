import { NextRequest, NextResponse } from "next/server";
import {
  executorProjectPath,
  parseCodeKlant,
  validateProjectSlug,
} from "@/lib/code-workspace";
import { callCodeExecutor, getCodeExecutorStatus } from "@/lib/code-executor";

export const runtime = "nodejs";

const ALLOWED_PREFIXES = [
  "npm ",
  "npx ",
  "node ",
  "python3 ",
  "pnpm ",
  "yarn ",
  "git status",
  "git diff",
  "git log",
  "ls",
  "pwd",
  "cat ",
  "make ",
];

function isAllowedCommand(cmd: string): boolean {
  const c = cmd.trim();
  return ALLOWED_PREFIXES.some((p) => c === p.trim() || c.startsWith(p));
}

export async function POST(req: NextRequest) {
  const execStatus = await getCodeExecutorStatus();
  if (!execStatus.nuc.reachable && !execStatus.bridge.online) {
    return NextResponse.json(
      { error: "Geen executor bereikbaar (NUC of PC bridge)" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const klant = parseCodeKlant(typeof body.klant === "string" ? body.klant : null);
  const workspace =
    typeof body.workspace === "string" ? body.workspace.trim() : "";
  const command = typeof body.command === "string" ? body.command.trim() : "";

  if (!workspace || !validateProjectSlug(workspace)) {
    return NextResponse.json({ error: "workspace vereist" }, { status: 400 });
  }
  if (!command) {
    return NextResponse.json({ error: "command vereist" }, { status: 400 });
  }
  if (!isAllowedCommand(command)) {
    return NextResponse.json(
      {
        error: "Commando niet toegestaan",
        allowed: ALLOWED_PREFIXES,
      },
      { status: 400 }
    );
  }

  const r = await callCodeExecutor({
    op: "run_command",
    command,
    cwd: executorProjectPath(klant, workspace),
  });

  if (!r.ok && !r.data?.stdout && !r.data?.stderr) {
    return NextResponse.json(
      { error: r.error ?? "command failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: r.ok,
    stdout: String(r.data?.stdout ?? ""),
    stderr: String(r.data?.stderr ?? ""),
    exit_code: r.data?.exit_code ?? null,
  });
}
