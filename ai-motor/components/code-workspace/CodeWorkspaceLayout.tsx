"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { FileTree } from "@/components/code-workspace/FileTree";
import { CodeEditor } from "@/components/code-workspace/CodeEditor";
import { CodePreview } from "@/components/code-workspace/CodePreview";
import { CodeTerminal } from "@/components/code-workspace/CodeTerminal";
import { CodeGitBar } from "@/components/code-workspace/CodeGitBar";
import { AgentChat } from "@/components/code-workspace/AgentChat";
import { isHtmlPath } from "@/lib/code-file-language";
import { flattenFilePaths } from "@/lib/code-tree-utils";
import type { CodeSelectionContext } from "@/lib/code-agent/message-context";
import type { CodeTreeNode } from "@/lib/code-workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Workspace = { id: string; name: string };

export function CodeWorkspaceLayout({
  defaultKlant,
  importFrom,
}: {
  defaultKlant?: "fumero" | "bokas";
  importFrom?: "fumero";
} = {}) {
  const sp = useSearchParams();
  const company = useCompanyStore((s) => s.company);
  const importStarted = useRef(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [newName, setNewName] = useState("");
  const [sideTab, setSideTab] = useState<"files" | "terminal">("files");
  const [centerTab, setCenterTab] = useState<"editor" | "preview">("editor");
  const [treeRefresh, setTreeRefresh] = useState(0);
  const [executorOk, setExecutorOk] = useState<boolean | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [pendingSelection, setPendingSelection] =
    useState<CodeSelectionContext | null>(null);
  const [executorTarget, setExecutorTarget] = useState<string>("none");

  const loadWorkspaces = useCallback(async () => {
    const r = await fetch(
      `/api/code/workspaces?klant=${encodeURIComponent(company)}`,
      { credentials: "include", cache: "no-store" }
    );
    const d = (await r.json()) as { workspaces?: Workspace[] };
    setWorkspaces(d.workspaces ?? []);
  }, [company]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (defaultKlant) {
      useCompanyStore.getState().setCompany(defaultKlant);
    }
  }, [defaultKlant]);

  useEffect(() => {
    const ws = sp.get("workspace")?.trim();
    const file = sp.get("file")?.trim();
    const klantParam = sp.get("klant")?.trim();
    const klant =
      klantParam === "bokas" || klantParam === "fumero" ? klantParam : company;
    if (klantParam === "bokas" || klantParam === "fumero") {
      useCompanyStore.getState().setCompany(klantParam);
    }
    if (ws) setActiveWorkspace(ws);
    if (ws && file) {
      void fetch(
        `/api/code/files?klant=${encodeURIComponent(klant)}&workspace=${encodeURIComponent(ws)}&path=${encodeURIComponent(file)}`,
        { credentials: "include" }
      )
        .then((r) => r.json())
        .then((data: { content?: string }) => {
          setActiveFile(file);
          setFileContent(data.content ?? "");
          if (isHtmlPath(file)) setCenterTab("preview");
          else setCenterTab("editor");
        })
        .catch(() => {});
    }
  }, [sp, company]);

  useEffect(() => {
    const importKind = sp.get("import")?.trim();
    if (importKind !== "fumero-tool" || importStarted.current) return;
    const slug = sp.get("slug")?.trim();
    const tool = sp.get("tool")?.trim();
    if (!slug && !tool) return;
    importStarted.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/code/import/fumero-tool", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            klant: defaultKlant ?? company,
            slug: slug || undefined,
            tool: tool || undefined,
            from:
              importFrom ??
              (defaultKlant === "fumero" || sp.get("klant") === "fumero"
                ? "fumero"
                : undefined),
          }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (data.url) {
          window.location.replace(data.url);
        }
      } catch {
        importStarted.current = false;
      }
    })();
  }, [sp, company, defaultKlant, importFrom]);

  useEffect(() => {
    fetch("/api/code/executor-target", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const active = String(d.active ?? "none");
        setExecutorTarget(active);
        setExecutorOk(active !== "none");
      })
      .catch(() => {
        setExecutorTarget("none");
        setExecutorOk(false);
      });
  }, []);

  const loadWorkspaceFiles = useCallback(async () => {
    if (!activeWorkspace) {
      setWorkspaceFiles([]);
      return;
    }
    const res = await fetch(
      `/api/code/files?klant=${encodeURIComponent(company)}&workspace=${encodeURIComponent(activeWorkspace)}&tree=1`,
      { credentials: "include", cache: "no-store" }
    );
    if (!res.ok) return;
    const data = (await res.json()) as { tree?: CodeTreeNode[] };
    setWorkspaceFiles(flattenFilePaths(data.tree ?? []));
  }, [company, activeWorkspace]);

  useEffect(() => {
    void loadWorkspaceFiles();
  }, [loadWorkspaceFiles, treeRefresh]);

  async function createWorkspace() {
    const name = newName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    const res = await fetch("/api/code/workspaces", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ klant: company, name }),
    });
    if (!res.ok) return;
    const ws = (await res.json()) as Workspace;
    setWorkspaces((prev) => [...prev, ws]);
    setActiveWorkspace(ws.id);
    setNewName("");
    setTreeRefresh((k) => k + 1);
  }

  async function openFile(filePath: string) {
    if (!activeWorkspace) return;
    const res = await fetch(
      `/api/code/files?klant=${encodeURIComponent(company)}&workspace=${encodeURIComponent(activeWorkspace)}&path=${encodeURIComponent(filePath)}`,
      { credentials: "include" }
    );
    const data = (await res.json()) as { content?: string };
    setActiveFile(filePath);
    setFileContent(data.content ?? "");
    if (isHtmlPath(filePath)) setCenterTab("preview");
    else setCenterTab("editor");
  }

  function onFilesChanged(files: string[]) {
    setTreeRefresh((k) => k + 1);
    if (activeFile && files.includes(activeFile)) {
      void openFile(activeFile);
    } else if (files[0]) {
      void openFile(files[0]);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {executorOk === false && (
        <div className="shrink-0 border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-text-primary">
          Geen code-executor bereikbaar (NUC of PC bridge).{" "}
          <Link
            href="/cowork?tab=bridge"
            className="text-accent underline-offset-2 hover:underline"
          >
            Koppel je laptop
          </Link>
          .
        </div>
      )}
      {executorOk !== false && executorTarget !== "none" && (
        <div className="shrink-0 border-b border-border px-4 py-1 text-[10px] text-text-secondary">
          Executor:{" "}
          {executorTarget === "bridge"
            ? "PC bridge"
            : executorTarget === "nuc"
              ? "NUC local"
              : executorTarget}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Project list */}
        <div className="flex w-44 shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border p-2">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">
              {company}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  setActiveWorkspace(ws.id);
                  setActiveFile(null);
                  setFileContent("");
                }}
                className={cn(
                  "mb-1 w-full truncate rounded-lg px-2 py-1.5 text-left text-sm",
                  activeWorkspace === ws.id
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-text-primary hover:bg-surface-elevated"
                )}
              >
                {ws.name}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2 space-y-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createWorkspace()}
              placeholder="nieuw project…"
              className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="w-full text-xs"
              onClick={() => void createWorkspace()}
            >
              + Aanmaken
            </Button>
          </div>
        </div>

        {/* Tree / terminal */}
        {activeWorkspace && (
          <div className="flex w-52 shrink-0 flex-col border-r border-border">
            <div className="flex gap-1 border-b border-border p-2">
              <button
                type="button"
                onClick={() => setSideTab("files")}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  sideTab === "files"
                    ? "bg-surface-elevated"
                    : "text-text-secondary"
                )}
              >
                Bestanden
              </button>
              <button
                type="button"
                onClick={() => setSideTab("terminal")}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  sideTab === "terminal"
                    ? "bg-surface-elevated"
                    : "text-text-secondary"
                )}
              >
                Terminal
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sideTab === "files" ? (
                <FileTree
                  klant={company}
                  workspace={activeWorkspace}
                  onFileClick={(p) => void openFile(p)}
                  activeFile={activeFile}
                  refreshKey={treeRefresh}
                />
              ) : (
                <CodeTerminal klant={company} workspace={activeWorkspace} />
              )}
            </div>
            <CodeGitBar klant={company} workspace={activeWorkspace} />
          </div>
        )}

        {/* Editor / preview */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeFile && activeWorkspace ? (
            <>
              <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setCenterTab("editor")}
                  className={cn(
                    "rounded px-2 py-1 text-xs",
                    centerTab === "editor"
                      ? "bg-surface-elevated font-medium"
                      : "text-text-secondary"
                  )}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setCenterTab("preview")}
                  className={cn(
                    "rounded px-2 py-1 text-xs",
                    centerTab === "preview"
                      ? "bg-surface-elevated font-medium"
                      : "text-text-secondary"
                  )}
                >
                  Preview
                </button>
              </div>
              <div className="min-h-0 flex-1">
                {centerTab === "editor" ? (
                  <CodeEditor
                    filePath={activeFile}
                    content={fileContent}
                    klant={company}
                    workspace={activeWorkspace}
                    onChange={setFileContent}
                    onAnnotate={setPendingSelection}
                  />
                ) : (
                  <CodePreview filePath={activeFile} content={fileContent} />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-text-secondary">
              <p>
                {activeWorkspace
                  ? "Selecteer een bestand"
                  : "Kies of maak een project"}
              </p>
            </div>
          )}
        </div>

        {/* Agent */}
        <div className="w-[min(24rem,35vw)] shrink-0">
          <AgentChat
            klant={company}
            workspace={activeWorkspace}
            openFiles={activeFile ? [activeFile] : []}
            filePaths={workspaceFiles}
            pendingSelection={pendingSelection}
            onClearSelection={() => setPendingSelection(null)}
            onFilesChanged={onFilesChanged}
          />
        </div>
      </div>
    </div>
  );
}
