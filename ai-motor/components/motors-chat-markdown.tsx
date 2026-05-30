"use client";

import { useCallback, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "user" | "assistant" | "fumeroUser";

function CodeBlockWithCopy({
  className,
  children,
  user,
}: {
  className?: string;
  children: React.ReactNode;
  user: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text =
    typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children.map(String).join("")
        : String(children ?? "");

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <div className="group relative my-2">
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "ios-tap-highlight absolute right-2 top-2 z-10 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100",
          user
            ? "bg-black/30 text-white hover:bg-black/40"
            : "bg-surface text-text-secondary hover:bg-border hover:text-text-primary"
        )}
        title="Code kopiëren"
        aria-label="Code kopiëren"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre
        className={cn(
          "overflow-x-auto rounded-lg p-3 pr-12 text-xs leading-relaxed",
          user ? "bg-black/25 text-white" : "bg-surface-elevated text-text-primary"
        )}
      >
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function MotorsChatMarkdown({
  content,
  variant,
}: {
  content: string;
  variant: Variant;
}) {
  const user = variant === "user";
  const fumeroUser = variant === "fumeroUser";
  const lightBubble = fumeroUser;

  const components: Components = {
    p: ({ children }) => (
      <p
        className={cn(
          "mb-2 last:mb-0",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong
        className={cn(
          "font-semibold",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className={cn("italic", user && !lightBubble ? "text-white/95" : undefined)}>
        {children}
      </em>
    ),
    ul: ({ children }) => (
      <ul
        className={cn(
          "my-2 list-disc space-y-1 pl-5",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          "my-2 list-decimal space-y-1 pl-5",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed [&>p]:mb-0">{children}</li>
    ),
    h1: ({ children }) => (
      <h1
        className={cn(
          "mb-2 mt-3 text-base font-semibold first:mt-0",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={cn(
          "mb-2 mt-3 text-base font-semibold first:mt-0",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={cn(
          "mb-1 mt-2 text-sm font-semibold first:mt-0",
          user && !lightBubble ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </h3>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "underline underline-offset-2",
          user && !lightBubble ? "text-white" : "text-accent"
        )}
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto rounded-lg border border-border/60">
        <table className="min-w-full border-collapse text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={user && !lightBubble ? "bg-white/10" : "bg-surface-elevated"}>
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="border border-border/50 px-2 py-1.5 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border/50 px-2 py-1.5">{children}</td>
    ),
    code: ({ className, children, ...props }) => {
      const block = Boolean(className?.includes("language-"));
      if (block) {
        return (
          <CodeBlockWithCopy className={className} user={user && !lightBubble}>
            {children}
          </CodeBlockWithCopy>
        );
      }
      return (
        <code
          className={cn(
            "rounded px-1 py-0.5 text-xs",
            user && !lightBubble
              ? "bg-white/20 text-white"
              : "bg-surface-elevated text-text-primary"
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => <>{children}</>,
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "my-2 border-l-2 pl-3 opacity-90",
          user && !lightBubble ? "border-white/50" : "border-text-secondary"
        )}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr
        className={cn(
          "my-3 border-0 border-t",
          user && !lightBubble ? "border-white/30" : "border-border"
        )}
      />
    ),
  };

  return (
    <div className="chat-markdown">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
