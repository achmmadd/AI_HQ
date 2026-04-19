"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Variant = "user" | "assistant";

export function ChatMarkdown({
  content,
  variant,
}: {
  content: string;
  variant: Variant;
}) {
  const user = variant === "user";

  const components: Components = {
    p: ({ children }) => (
      <p
        className={cn(
          "mb-2 last:mb-0",
          user ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong
        className={cn(
          "font-semibold",
          user ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className={cn("italic", user ? "text-white/95" : undefined)}>
        {children}
      </em>
    ),
    ul: ({ children }) => (
      <ul
        className={cn(
          "my-2 list-disc space-y-1 pl-5",
          user ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          "my-2 list-decimal space-y-1 pl-5",
          user ? "text-white" : "text-text-primary"
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
          user ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={cn(
          "mb-2 mt-3 text-base font-semibold first:mt-0",
          user ? "text-white" : "text-text-primary"
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={cn(
          "mb-1 mt-2 text-sm font-semibold first:mt-0",
          user ? "text-white" : "text-text-primary"
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
          user ? "text-white" : "text-accent"
        )}
      >
        {children}
      </a>
    ),
    code: ({ className, children, ...props }) => {
      const block = Boolean(className?.includes("language-"));
      if (block) {
        return (
          <code
            className={cn(
              "block overflow-x-auto rounded-lg p-2 text-xs",
              user ? "bg-black/25 text-white" : "bg-surface-elevated text-text-primary"
            )}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className={cn(
            "rounded px-1 py-0.5 text-xs",
            user
              ? "bg-white/20 text-white"
              : "bg-surface-elevated text-text-primary"
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 overflow-x-auto rounded-lg p-2 text-xs">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "my-2 border-l-2 pl-3 opacity-90",
          user ? "border-white/50" : "border-text-secondary"
        )}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr
        className={cn(
          "my-3 border-0 border-t",
          user ? "border-white/30" : "border-border"
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
