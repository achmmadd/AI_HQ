"use client";

import { motion } from "framer-motion";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const skills: SkillItem[] = [
  {
    id: "s1",
    name: "Factory Inbox",
    description: "E-mail en tickets naar één agent-stroom.",
    category: "Productiviteit",
    state: "installed",
  },
  {
    id: "s2",
    name: "Kennis Zoeker",
    description: "Qdrant + embeddings; client-filter.",
    category: "Kennis",
    state: "installed",
  },
  {
    id: "s3",
    name: "Rapport Builder",
    description: "PDF/Sheets uit Dify workflows.",
    category: "Finance",
    state: "available",
    costHint: "€9/mnd",
  },
  {
    id: "s4",
    name: "Voice Desk",
    description: "Spraak → tekst → n8n (binnenkort).",
    category: "Support",
    state: "soon",
  },
  {
    id: "s5",
    name: "Compliance Check",
    description: "Policy snippets en audit trail.",
    category: "Legal",
    state: "available",
    costHint: "€19/mnd",
  },
  {
    id: "s6",
    name: "Growth Copilot",
    description: "Campagnes en varianten (mock).",
    category: "Marketing",
    state: "available",
  },
];

function badge(s: SkillItem["state"]) {
  switch (s) {
    case "installed":
      return "bg-success/15 text-success";
    case "soon":
      return "bg-warning/15 text-warning";
    default:
      return "bg-accent/15 text-accent";
  }
}

export function AppStoreGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {skills.map((sk, i) => (
        <motion.div
          key={sk.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03 }}
        >
          <Card className="flex h-full flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    badge(sk.state)
                  )}
                >
                  {sk.state === "installed"
                    ? "Geïnstalleerd"
                    : sk.state === "soon"
                      ? "Binnenkort"
                      : "Beschikbaar"}
                </span>
              </div>
              <CardTitle className="pt-2 text-lg">{sk.name}</CardTitle>
              <CardDescription>{sk.description}</CardDescription>
              <p className="text-xs text-text-secondary">{sk.category}</p>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between pt-2">
              {sk.costHint && (
                <span className="text-sm text-text-secondary">{sk.costHint}</span>
              )}
              <Button
                size="sm"
                variant={sk.state === "installed" ? "secondary" : "default"}
                className="rounded-xl"
                disabled={sk.state === "soon"}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {sk.state === "installed" ? "Beheer" : "Installeren"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
