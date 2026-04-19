"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyStore } from "@/stores/useCompanyStore";

type TodoRow = {
  id: number;
  title: string;
  status: string;
  priority?: string;
  klant?: string;
};

type AgendaRow = {
  id: number;
  title: string;
  start_time: string;
  end_time?: string | null;
  description?: string | null;
};

export function AgendaBoard() {
  const company = useCompanyStore((s) => s.company);
  const klant = company === "fumero" || company === "bokas" ? company : "fumero";
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [events, setEvents] = useState<AgendaRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, er] = await Promise.all([
        fetch(`/api/todos?klant=${encodeURIComponent(klant)}`),
        fetch(`/api/agenda?klant=${encodeURIComponent(klant)}`),
      ]);
      const tj = await tr.json();
      const ej = await er.json();
      setTodos(Array.isArray(tj.todos) ? tj.todos : []);
      setEvents(Array.isArray(ej.events) ? ej.events : []);
    } catch {
      setTodos([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [klant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        klant,
        source: "ui",
        priority: "normaal",
      }),
    });
    setDraft("");
    void load();
  }

  async function toggleDone(todo: TodoRow) {
    const next = todo.status === "done" ? "open" : "done";
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    void load();
  }

  async function remove(id: number) {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Todo</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">{klant}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void load()}
              aria-label="Vernieuwen"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <p className="text-sm text-text-secondary">Laden…</p>
          )}
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
            {todos.map((it, i) => (
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
                  checked={it.status === "done"}
                  onChange={() => void toggleDone(it)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                <span
                  className={
                    it.status === "done"
                      ? "flex-1 text-text-secondary line-through"
                      : "flex-1"
                  }
                >
                  {it.title}
                  {it.priority && it.priority !== "normaal" && (
                    <span className="ml-2 text-[10px] uppercase text-accent">
                      {it.priority}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-text-secondary"
                  onClick={() => void remove(it.id)}
                  aria-label="Verwijderen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.li>
            ))}
          </ul>
          {!loading && todos.length === 0 && (
            <p className="text-sm text-text-secondary">Nog geen taken in SQLite.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Agenda</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            Vernieuwen
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-text-secondary">
          {events.length === 0 && !loading && (
            <p>Geen events. Factory OS kan ze aanmaken via POST /api/sync.</p>
          )}
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-xl border border-border bg-surface-elevated p-3"
            >
              <p className="font-medium text-text-primary">{ev.start_time}</p>
              <p className="text-text-primary">{ev.title}</p>
              {ev.description && <p className="mt-1 text-xs">{ev.description}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
