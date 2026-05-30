"use client";

import { useEffect, useState } from "react";
import type { CodeTreeNode } from "@/lib/code-workspace";

function TreeNode({
  node,
  onFileClick,
  activeFile,
  depth = 0,
}: {
  node: CodeTreeNode;
  onFileClick: (path: string) => void;
  activeFile: string | null;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 12;

  if (node.type === "directory") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full truncate text-left px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-elevated"
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          {open ? "▾" : "▸"} {node.name}
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              onFileClick={onFileClick}
              activeFile={activeFile}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onFileClick(node.path)}
      className={`w-full truncate text-left px-2 py-0.5 text-xs hover:bg-surface-elevated ${
        activeFile === node.path
          ? "bg-accent/15 text-accent"
          : "text-text-primary"
      }`}
      style={{ paddingLeft: `${indent + 8}px` }}
    >
      {node.name}
    </button>
  );
}

export function FileTree({
  klant,
  workspace,
  onFileClick,
  activeFile,
  refreshKey,
}: {
  klant: string;
  workspace: string;
  onFileClick: (path: string) => void;
  activeFile: string | null;
  refreshKey: number;
}) {
  const [tree, setTree] = useState<CodeTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    fetch(
      `/api/code/files?klant=${encodeURIComponent(klant)}&workspace=${encodeURIComponent(workspace)}&tree=1`,
      { credentials: "include", cache: "no-store" }
    )
      .then((r) => r.json())
      .then((d) => setTree(d.tree ?? []))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [klant, workspace, refreshKey]);

  if (loading) {
    return <p className="p-2 text-xs text-text-secondary">Laden…</p>;
  }

  return (
    <div className="py-1">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          onFileClick={onFileClick}
          activeFile={activeFile}
        />
      ))}
    </div>
  );
}
