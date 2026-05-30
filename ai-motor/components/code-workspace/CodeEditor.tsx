"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { languageFromPath } from "@/lib/code-file-language";
import type { CodeSelectionContext } from "@/lib/code-agent/message-context";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
      Editor laden…
    </div>
  ),
});

export function CodeEditor({
  filePath,
  content,
  klant,
  workspace,
  onChange,
  onAnnotate,
}: {
  filePath: string;
  content: string;
  klant: string;
  workspace: string;
  onChange: (content: string) => void;
  onAnnotate?: (selection: CodeSelectionContext) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const saveRef = useRef<() => void>(() => {});
  const selectionRef = useRef<CodeSelectionContext | null>(null);

  const saveFile = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/code/files", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klant,
          workspace,
          path: filePath,
          content,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [klant, workspace, filePath, content]);

  saveRef.current = () => {
    void saveFile();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="truncate font-mono text-xs text-text-secondary">
          {filePath}
        </span>
        <div className="flex items-center gap-2">
          {onAnnotate && hasSelection ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                const sel = selectionRef.current;
                if (sel) onAnnotate(sel);
              }}
            >
              → Agent
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => void saveFile()}
          >
            {saving ? "Opslaan…" : saved ? "Opgeslagen" : "Opslaan"}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <MonacoEditor
          key={filePath}
          language={languageFromPath(filePath)}
          theme="vs-dark"
          value={content}
          onChange={(v) => onChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            automaticLayout: true,
          }}
          onMount={(editor, monaco) => {
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
              () => saveRef.current()
            );
            editor.onDidChangeCursorSelection(() => {
              const sel = editor.getSelection();
              const model = editor.getModel();
              if (!sel || !model || sel.isEmpty()) {
                setHasSelection(false);
                selectionRef.current = null;
                return;
              }
              const text = model.getValueInRange(sel);
              if (!text.trim()) {
                setHasSelection(false);
                selectionRef.current = null;
                return;
              }
              setHasSelection(true);
              selectionRef.current = {
                path: filePath,
                startLine: sel.startLineNumber,
                endLine: sel.endLineNumber,
                text,
              };
            });
          }}
        />
      </div>
    </div>
  );
}
