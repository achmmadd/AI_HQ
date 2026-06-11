"use client";

import { useCallback, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mic, Paperclip, Sparkles } from "lucide-react";
import {
  BUILDER_PROMPT_EXAMPLE,
  BUILDER_PROMPT_PLACEHOLDER,
} from "@/lib/fumero/builder-content";
import { cn } from "@/lib/utils";

type BuilderPromptCardProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  onUploadClick?: () => void;
  onVoiceClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  listening?: boolean;
};

export function BuilderPromptCard({
  value,
  onChange,
  onSubmit,
  onUploadClick,
  onVoiceClick,
  disabled = false,
  loading = false,
  listening = false,
}: BuilderPromptCardProps) {
  const reduceMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || loading) return;
    onSubmit(trimmed);
  }, [value, disabled, loading, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      className={cn(
        "builder-prompt-card group relative overflow-hidden rounded-[20px] transition-all duration-300",
        focused && "builder-prompt-card--focused",
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
    >
      <div className="builder-prompt-card__inner">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={BUILDER_PROMPT_PLACEHOLDER}
          rows={4}
          disabled={disabled || loading}
          className="builder-prompt-card__input"
          autoComplete="off"
        />

        {focused && !value ? (
          <p className="builder-prompt-card__hint">
            Bijv. {BUILDER_PROMPT_EXAMPLE}
          </p>
        ) : null}

        <div className="builder-prompt-card__toolbar">
          <div className="flex items-center gap-1">
            {onUploadClick ? (
              <button
                type="button"
                onClick={onUploadClick}
                disabled={disabled || loading}
                className="builder-icon-btn"
                title="Bijlage toevoegen"
              >
                <Paperclip className="h-[18px] w-[18px]" />
              </button>
            ) : null}
            {onVoiceClick ? (
              <button
                type="button"
                onClick={onVoiceClick}
                disabled={disabled || loading}
                className={cn(
                  "builder-icon-btn",
                  listening && "builder-icon-btn--active",
                )}
                title="Spraak"
              >
                <Mic className="h-[18px] w-[18px]" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled || loading}
            className="builder-cta-btn"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Bouw nu
          </button>
        </div>
      </div>
    </motion.div>
  );
}
