"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

type MotorSkill = {
  id: number;
  klant: string;
  slug: string;
  title: string;
  description: string | null;
  prompt_template: string;
  config_json: string | null;
  enabled: number;
  created_at: string;
};

const EMPTY_FORM = {
  title: "",
  slug: "",
  description: "",
  prompt_template: "",
  enabled: true,
};

export function CoworkSkillsPanel() {
  const company = useCompanyStore((s) => s.company);
  const [skills, setSkills] = useState<MotorSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(
        `/api/cowork/skills?klant=${encodeURIComponent(company)}`,
        { credentials: "include", cache: "no-store" }
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { skills?: MotorSkill[] };
      setSkills(json.skills ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(skill: MotorSkill) {
    setEditId(skill.id);
    setForm({
      title: skill.title,
      slug: skill.slug,
      description: skill.description ?? "",
      prompt_template: skill.prompt_template,
      enabled: skill.enabled === 1,
    });
    setShowForm(true);
  }

  async function saveSkill() {
    setBusyId(editId ?? "new");
    setErr(null);
    try {
      const payload = {
        klant: company,
        title: form.title,
        slug: form.slug || undefined,
        description: form.description || null,
        prompt_template: form.prompt_template,
        enabled: form.enabled,
      };

      const res = editId
        ? await fetch(`/api/cowork/skills/${editId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          })
        : await fetch("/api/cowork/skills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? (await res.text()));
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSkill(id: number) {
    if (!window.confirm("Skill verwijderen?")) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/cowork/skills/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verwijderen mislukt");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnabled(skill: MotorSkill) {
    setBusyId(skill.id);
    setErr(null);
    try {
      const res = await fetch(`/api/cowork/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: skill.enabled !== 1 }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Motor skills voor klant <span className="font-medium">{company}</span>
        </p>
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          onClick={startCreate}
        >
          Nieuwe skill
        </Button>
      </div>

      {err && (
        <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-surface-elevated/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {editId ? "Skill bewerken" : "Nieuwe skill"}
          </h3>
          <input
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Titel"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Slug (optioneel)"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <textarea
            className="min-h-[60px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Beschrijving"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-mono"
            placeholder="Prompt template"
            value={form.prompt_template}
            onChange={(e) =>
              setForm((f) => ({ ...f, prompt_template: e.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, enabled: e.target.checked }))
              }
            />
            Actief
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={busyId === "new" || busyId === editId}
              onClick={() => void saveSkill()}
            >
              Opslaan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
            >
              Annuleren
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-sm text-text-secondary">Laden…</p>
      )}

      <ul className="space-y-3">
        {skills.map((skill) => (
          <li
            key={skill.id}
            className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    skill.enabled === 1 ? "text-green-600" : "text-text-secondary"
                  )}
                >
                  {skill.enabled === 1 ? "actief" : "uit"} · {skill.slug}
                </p>
                <h3 className="mt-0.5 font-medium text-text-primary">
                  {skill.title}
                </h3>
                {skill.description && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {skill.description}
                  </p>
                )}
                <p className="mt-2 line-clamp-2 font-mono text-[11px] text-text-secondary">
                  {skill.prompt_template}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl"
                  disabled={busyId === skill.id}
                  onClick={() => void toggleEnabled(skill)}
                >
                  {skill.enabled === 1 ? "Uitschakelen" : "Inschakelen"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl"
                  disabled={busyId === skill.id}
                  onClick={() => startEdit(skill)}
                >
                  Bewerken
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl text-error"
                  disabled={busyId === skill.id}
                  onClick={() => void deleteSkill(skill.id)}
                >
                  Verwijderen
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!loading && skills.length === 0 && (
        <p className="text-sm text-text-secondary">
          Nog geen skills — maak er een aan.
        </p>
      )}
    </div>
  );
}
