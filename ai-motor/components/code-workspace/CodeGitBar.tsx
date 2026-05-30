"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeployButton } from "@/components/DeployButton";

export function CodeGitBar({
  klant,
  workspace,
}: {
  klant: string;
  workspace: string;
}) {
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch(
      `/api/code/git?klant=${encodeURIComponent(klant)}&workspace=${encodeURIComponent(workspace)}`,
      { credentials: "include", cache: "no-store" }
    );
    const data = (await res.json()) as { stdout?: string; branch?: string };
    setStatus(data.stdout?.trim() || "(schone tree)");
    if (data.branch) setBranch(data.branch);
  }, [klant, workspace]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function runAction(
    action: "commit" | "push" | "pull" | "branch" | "checkout" | "pr"
  ) {
    setBusy(true);
    try {
      const res = await fetch("/api/code/git", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klant,
          workspace,
          action,
          message,
          branch: newBranch || branch,
        }),
      });
      const data = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus([data.stdout, data.stderr].filter(Boolean).join("\n").trim());
      if (action === "commit") setMessage("");
    } catch (e) {
      setStatus(`❌ ${String(e)}`);
    } finally {
      setBusy(false);
      void loadStatus();
    }
  }

  return (
    <div className="shrink-0 space-y-2 border-t border-border p-2">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary">
        Git · {branch}
      </p>
      <pre className="max-h-20 overflow-auto rounded border border-border bg-background p-2 font-mono text-[10px] text-text-secondary whitespace-pre-wrap">
        {status || "…"}
      </pre>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="commit message…"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="flex-1 text-xs"
          disabled={busy || !message.trim()}
          onClick={() => void runAction("commit")}
        >
          Commit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-1 text-xs"
          disabled={busy}
          onClick={() => void runAction("push")}
        >
          Push
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-1 text-xs"
          disabled={busy}
          onClick={() => void runAction("pull")}
        >
          Pull
        </Button>
      </div>
      <input
        value={newBranch}
        onChange={(e) => setNewBranch(e.target.value)}
        placeholder="nieuwe branch…"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-1 text-xs"
          disabled={busy || !newBranch.trim()}
          onClick={() => void runAction("branch")}
        >
          Branch
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-1 text-xs"
          disabled={busy}
          onClick={() => void runAction("pr")}
        >
          PR
        </Button>
      </div>
      <DeployButton
        source="code"
        klant={klant}
        workspace={workspace}
        slug={workspace}
        environment="production"
        compact
      />
    </div>
  );
}
