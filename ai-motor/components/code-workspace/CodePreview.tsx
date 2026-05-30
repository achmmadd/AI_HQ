"use client";

import { LivePreview } from "@/components/live-preview";

export function CodePreview({
  filePath,
  content,
}: {
  filePath: string;
  content: string;
}) {
  const isHtml = /\.(html?)$/i.test(filePath);

  if (!isHtml) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6 text-center text-sm text-text-secondary">
        <p>
          Preview werkt voor <span className="font-mono">.html</span>-bestanden.
          <br />
          Open een HTML-bestand of laat de agent er een maken.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <span className="font-mono text-xs text-text-secondary">
          Preview · {filePath}
        </span>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        <LivePreview
          code={content}
          title={`Preview ${filePath}`}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
