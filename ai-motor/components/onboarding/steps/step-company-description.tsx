"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  buildAiUnderstandingPreview,
  type BusinessTypeId,
  type OnboardingGoalId,
} from "@/lib/onboarding-data";

type StepCompanyDescriptionProps = {
  value: string;
  onChange: (value: string) => void;
  goal: OnboardingGoalId | null;
  businessType: BusinessTypeId | null;
};

export function StepCompanyDescription({
  value,
  onChange,
  goal,
  businessType,
}: StepCompanyDescriptionProps) {
  const preview = buildAiUnderstandingPreview(value, businessType, goal);
  const hasInput = value.trim().length > 20;

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Vertel over je bedrijf
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-text-secondary md:text-base">
          In gewone taal. MotorsAI leest mee en toont direct wat het begrijpt.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <label
            htmlFor="company-description"
            className="text-sm font-medium text-text-primary"
          >
            Bedrijfsomschrijving
          </label>
          <Textarea
            id="company-description"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={7}
            placeholder="Bijv.: Wij verkopen premium outdoor gear in Nederland. Ons team helpt klanten met advies over uitrusting. We willen sneller reageren op vragen en meer content publiceren."
            className="min-h-[180px] resize-none rounded-2xl border-[var(--onboarding-card-border)] bg-[var(--onboarding-input-bg)] px-4 py-3 text-base leading-relaxed text-text-primary"
          />
          <p className="text-xs text-text-secondary">
            Minimaal 20 tekens om door te gaan.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] p-5 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Brain className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                AI-begrip
              </p>
              <p className="text-xs text-text-secondary">Live preview</p>
            </div>
            {hasInput ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-auto flex items-center gap-1 text-xs font-medium text-accent"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                Analyseren
              </motion.span>
            ) : null}
          </div>

          <dl className="space-y-4">
            {(
              [
                ["Sector", preview.industry],
                ["Focus", preview.focus],
                ["Tone of voice", preview.tone],
                ["Prioriteit", preview.priority],
              ] as const
            ).map(([label, val], i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                  {label}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-text-primary">
                  {val}
                </dd>
              </motion.div>
            ))}
          </dl>
        </motion.div>
      </div>
    </>
  );
}
