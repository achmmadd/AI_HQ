"use client";

import { motion } from "framer-motion";
import type { TeamMember } from "@/lib/onboarding-data";

type StepTeamRevealProps = {
  team: TeamMember[];
};

export function StepTeamReveal({ team }: StepTeamRevealProps) {
  return (
    <>
      <div className="mb-8 text-center">
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent"
        >
          Klaar voor actie
        </motion.p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Jouw AI-team
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Drie gespecialiseerde agents, afgestemd op jouw doel en sector.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {team.map((member, i) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: 0.15 + i * 0.12,
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative overflow-hidden rounded-2xl border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] p-5 backdrop-blur-sm"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/[0.08] blur-2xl" />
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
              <member.icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-base font-semibold text-text-primary">{member.name}</p>
            <p className="mt-0.5 text-xs font-medium text-accent">{member.role}</p>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              {member.specialty}
            </p>
          </motion.div>
        ))}
      </div>
    </>
  );
}
