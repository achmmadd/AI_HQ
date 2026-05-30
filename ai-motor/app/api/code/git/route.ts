import { NextRequest, NextResponse } from "next/server";
import {
  executorProjectPath,
  parseCodeKlant,
  validateProjectSlug,
} from "@/lib/code-workspace";
import { callCodeExecutor, getCodeExecutorStatus } from "@/lib/code-executor";

export const runtime = "nodejs";

function sanitizeCommitMessage(msg: string): string {
  return msg.replace(/[\r\n\0`$\\]/g, " ").trim().slice(0, 200);
}

async function runGit(cwd: string, command: string) {
  return callCodeExecutor({ op: "run_command", command, cwd });
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const klant = parseCodeKlant(sp.get("klant"));
  const workspace = sp.get("workspace")?.trim() ?? "";

  if (!workspace || !validateProjectSlug(workspace)) {
    return NextResponse.json({ error: "workspace vereist" }, { status: 400 });
  }

  const cwd = executorProjectPath(klant, workspace);
  const [status, branch] = await Promise.all([
    runGit(cwd, "git status --short"),
    runGit(cwd, "git branch --show-current"),
  ]);

  return NextResponse.json({
    ok: status.ok,
    stdout: String(status.data?.stdout ?? ""),
    stderr: String(status.data?.stderr ?? ""),
    branch: String(branch.data?.stdout ?? "").trim() || "main",
    exit_code: status.data?.exit_code ?? null,
  });
}

export async function POST(req: NextRequest) {
  const execStatus = await getCodeExecutorStatus();
  if (execStatus.active === "none") {
    return NextResponse.json({ error: "Executor offline" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const klant = parseCodeKlant(typeof body.klant === "string" ? body.klant : null);
  const workspace =
    typeof body.workspace === "string" ? body.workspace.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const message =
    typeof body.message === "string" ? sanitizeCommitMessage(body.message) : "";
  const branchName =
    typeof body.branch === "string" ? body.branch.trim().replace(/[^\w./-]/g, "") : "";

  if (!workspace || !validateProjectSlug(workspace)) {
    return NextResponse.json({ error: "workspace vereist" }, { status: 400 });
  }

  const cwd = executorProjectPath(klant, workspace);

  if (action === "commit") {
    if (!message) {
      return NextResponse.json({ error: "commit message vereist" }, { status: 400 });
    }
    const add = await runGit(cwd, "git add -A");
    if (!add.ok) {
      return NextResponse.json({
        ok: false,
        stdout: String(add.data?.stdout ?? ""),
        stderr: String(add.data?.stderr ?? add.error ?? ""),
        exit_code: add.data?.exit_code ?? null,
        via: add.via,
      });
    }
    const commit = await runGit(
      cwd,
      `git commit -m ${JSON.stringify(message)}`
    );
    return NextResponse.json({
      ok: commit.ok,
      stdout: String(commit.data?.stdout ?? ""),
      stderr: String(commit.data?.stderr ?? ""),
      exit_code: commit.data?.exit_code ?? null,
      via: commit.via,
    });
  }

  let command = "";

  switch (action) {
    case "push":
      command = "git push";
      break;
    case "pull":
      command = "git pull --rebase";
      break;
    case "checkout":
      if (!branchName) {
        return NextResponse.json({ error: "branch vereist" }, { status: 400 });
      }
      command = `git checkout ${branchName}`;
      break;
    case "branch":
      if (!branchName) {
        return NextResponse.json({ error: "branch vereist" }, { status: 400 });
      }
      command = `git checkout -b ${branchName}`;
      break;
    case "pr": {
      if (!message) {
        return NextResponse.json({ error: "PR titel (message) vereist" }, { status: 400 });
      }
      command = `gh pr create --title ${JSON.stringify(message)} --body ${JSON.stringify("Motor AI code workspace")}`;
      break;
    }
    default:
      return NextResponse.json(
        { error: "action: commit|push|pull|checkout|branch|pr" },
        { status: 400 }
      );
  }

  const r = await runGit(cwd, command);
  return NextResponse.json({
    ok: r.ok,
    stdout: String(r.data?.stdout ?? ""),
    stderr: String(r.data?.stderr ?? ""),
    exit_code: r.data?.exit_code ?? null,
    via: r.via,
    hint: !r.ok && action === "pr" ? "Installeer gh CLI op executor" : undefined,
  });
}
