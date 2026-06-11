"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BUILDER_SUGGESTIONS } from "@/lib/fumero/builder-content";

type BuilderSuggestionCardsProps = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  variant?: "cards" | "chips";
};

const VISIBLE_SUGGESTIONS = BUILDER_SUGGESTIONS.slice(0, 4);

export function BuilderSuggestionCards({
  onSelect,
  disabled = false,
  variant = "cards",
}: BuilderSuggestionCardsProps) {
  const reduceMotion = useReducedMotion();

  if (variant === "chips") {
    return (
      <section
        className="builder-suggestions builder-suggestions--chips"
        aria-label="Snel starten"
      >
        <p className="builder-suggestions__label">Snel starten</p>
        <div className="builder-suggestions__chips">
          {VISIBLE_SUGGESTIONS.map((suggestion, i) => (
            <motion.button
              key={suggestion.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(suggestion.prompt)}
              className="builder-suggestion-chip"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + i * 0.03, duration: 0.3 }}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <span aria-hidden>{suggestion.emoji}</span>
              {suggestion.label}
            </motion.button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="builder-suggestions" aria-label="Snel starten">
      <p className="builder-vi-label mb-2">Snel starten</p>
      <div className="grid grid-cols-2 gap-2">
        {VISIBLE_SUGGESTIONS.map((suggestion, i) => (
          <motion.button
            key={suggestion.label}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion.prompt)}
            className="builder-suggestion-card group disabled:opacity-50"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.4 }}
            whileHover={reduceMotion ? undefined : { y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.99 }}
          >
            <span className="text-lg" aria-hidden>
              {suggestion.emoji}
            </span>
            <p className="builder-suggestion-card__label">{suggestion.label}</p>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
