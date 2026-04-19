"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyStore } from "@/stores/useCompanyStore";

type Todo = { id: string; title: string; done: boolean };

let seed = 0;
function nid() {
  return `t-${Date.now()}-${seed++}`;
}

export function AgendaBoard() {
  const company = useCompanyStore((s) => s.company);
  const [items, setItems] = useState<Todo[]>([
    { id: nid(), title: "Webhook factory-os smoke test", done: true },
    { id: nid(), title: "Qdrant payload · client veld controleren", done: false },
    { id: nid(), title: "PWA icons vervangen", done: false },
  ]);
  const [draft, setDraft] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setItems((x) => [...x, { id: nid(), title: t, done: false }]);
    setDraft("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Todo</CardTitle>
          <span className="text-xs text-text-secondary">{company}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={add} className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nieuwe taak…"
              className="rounded-xl"
            />
            <Button type="submit" size="icon" variant="secondary" className="rounded-xl shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <motion.li
                key={it.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={() =>
                    setItems((xs) =>
                      xs.map((x) =>
                        x.id === it.id ? { ...x, done: !x.done } : x
                      )
                    )
                  }
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                <span
                  className={
                    it.done ? "flex-1 text-text-secondary line-through" : "flex-1"
                  }
                >
                  {it.title}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-text-secondary"
                  onClick={() =>
                    setItems((xs) => xs.filter((x) => x.id !== it.id))
                  }
                  aria-label="Verwijderen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Agenda (mock)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-text-secondary">
          <div className="rounded-xl border border-border bg-surface-elevated p-3">
            <p className="font-medium text-text-primary">Ma 14:00</p>
            <p>Sync stack · n8n / Qdrant</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-3">
            <p className="font-medium text-text-primary">Di 10:30</p>
            <p>Review AI Motor UI</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated p-3">
            <p className="font-medium text-text-primary">Do 09:00</p>
            <p>Embedding batch · nieuwe docs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
