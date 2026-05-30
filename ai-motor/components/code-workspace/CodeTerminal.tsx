"use client";

import { useState } from "react";
import {
  codeTerminalKey,
  useCodeTerminalStore,
} from "@/stores/useCodeTerminalStore";

const ALLOWED_HINT =
  "npm run build, npm run dev, npm test, ls, git status, git diff, pwd";

export function CodeTerminal({
  klant,
  workspace,
}: {
  klant: string;
  workspace: string;
}) {
  const key = codeTerminalKey(klant, workspace);
  const output = useCodeTerminalStore((s) => s.outputByKey[key] ?? "");
  const appendOutput = useCodeTerminalStore((s) => s.appendOutput);
  const [cmd, setCmd] = useState("");
  const [running, setRunning] = useState(false);

  async function runCommand() {
    if (!cmd.trim() || running) return;
    setRunning(true);
    appendOutput(key, `\n$ ${cmd}\n`);

    try {
      const res = await fetch("/api/code/terminal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klant, workspace, command: cmd.trim() }),
      });
      const data = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        error?: string;
        exit_code?: number | null;
      };
      if (data.error) {
        appendOutput(key, `${data.error}\n`);
      } else {
        appendOutput(
          key,
          `${data.stdout ?? ""}${data.stderr ? `\n${data.stderr}` : ""}\n[exit ${data.exit_code}]\n`
        );
      }
    } catch (e) {
      appendOutput(key, `Fout: ${String(e)}\n`);
    }

    setCmd("");
    setRunning(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background font-mono text-xs">
      <div className="flex-1 overflow-y-auto p-2 whitespace-pre-wrap text-green-600 dark:text-green-400">
        {output || `Terminal — ${ALLOWED_HINT}`}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <span className="text-green-600">$</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runCommand()}
          placeholder="npm run build…"
          disabled={running}
          className="min-w-0 flex-1 bg-transparent text-text-primary focus:outline-none"
        />
        {running ? <span className="text-yellow-500">●</span> : null}
      </div>
    </div>
  );
}
