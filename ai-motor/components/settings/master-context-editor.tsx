"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Save } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/design-system/components";
import { formatMasterContextBlock } from "@/lib/master-context-format";
import { getWorkspaceTheme } from "@/stores/useCompanyStore";
import type { WorkspaceId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WORKSPACE_LABELS } from "@/lib/brand";
import { InlineLoading } from "@/components/ui/page-loading";
import {
  assessTeamContextQuality,
  FUMERO_CONTEXT_EXAMPLE,
} from "@/lib/fumero/context-quality";

const WORKSPACE_OPTIONS: { id: WorkspaceId; slug: string; label: string }[] = [
  { id: "fumero", slug: "fumero", label: WORKSPACE_LABELS.fumero },
  { id: "bokas", slug: "bokas", label: WORKSPACE_LABELS.bokas },
  { id: "personal", slug: "personal", label: WORKSPACE_LABELS.personal },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Beheerder",
  editor: "Editor",
  viewer: "Kijker",
};

type Props = {
  /** Pre-select workspace (e.g. from fumero/bokas route). */
  defaultWorkspace?: WorkspaceId;
  allowedWorkspaces?: WorkspaceId[];
};

export function MasterContextEditor({
  defaultWorkspace = "fumero",
  allowedWorkspaces,
}: Props) {
  const workspaces = useMemo(() => {
    if (!allowedWorkspaces?.length) return WORKSPACE_OPTIONS;
    return WORKSPACE_OPTIONS.filter((w) => allowedWorkspaces.includes(w.id));
  }, [allowedWorkspaces]);

  const [selected, setSelected] = useState<WorkspaceId>(
    workspaces.some((w) => w.id === defaultWorkspace)
      ? defaultWorkspace
      : (workspaces[0]?.id ?? "fumero")
  );
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const slug = workspaces.find((w) => w.id === selected)?.slug ?? selected;

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/workspaces/${slug}/context`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Laden mislukt");
      }
      const data = (await res.json()) as {
        content?: string;
        updated_at?: string;
      };
      setContent(data.content ?? "");
      setUpdatedAt(data.updated_at ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
      setContent("");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/workspaces/${slug}/context`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Opslaan mislukt");
      }
      const data = (await res.json()) as { updated_at?: string };
      setUpdatedAt(data.updated_at ?? new Date().toISOString());
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  const previewBlock = formatMasterContextBlock(content);
  const qualityIssues = assessTeamContextQuality(content);
  const theme = getWorkspaceTheme(selected);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {workspaces.length > 1 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Workspace kiezen"
        >
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => setSelected(ws.id)}
              className={cn(
                "min-h-[var(--ds-touch-min,44px)] rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                selected === ws.id
                  ? "bg-accent/15 text-accent"
                  : "border border-border bg-surface text-text-secondary hover:text-text-primary"
              )}
            >
              {ws.label}
            </button>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Teamcontext — {theme.name}</CardTitle>
          <CardDescription className="leading-relaxed">
            Beschrijf je bedrijf, doelgroep, tone-of-voice en belangrijke procedures.
            Agents gebruiken deze context in elke chat — vóór kennisbank en geheugen.
            Voor doorzoekbare documenten gebruik je de{" "}
            <a href="/kennisbank" className="underline">
              kennisbank
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <InlineLoading />
          ) : (
            <>
              {qualityIssues.length > 0 ? (
                <ul className="space-y-1 rounded-xl border border-border bg-surface-elevated/40 p-3 text-sm" role="status">
                  {qualityIssues.map((issue) => (
                    <li
                      key={issue.id}
                      className={issue.severity === "warning" ? "text-amber-800 dark:text-amber-300" : "text-text-secondary"}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="touch"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (content.trim() && !window.confirm("Voorbeeldcontext vervangt je huidige tekst in het veld. Doorgaan?")) return;
                    setContent(FUMERO_CONTEXT_EXAMPLE);
                    setSaved(false);
                  }}
                >
                  Voorbeeld invullen
                </Button>
              </div>
              <label
                className="block text-sm font-medium text-text-primary"
                htmlFor="master-context"
              >
                Over jullie team
              </label>
              <textarea
                id="master-context"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSaved(false);
                }}
                rows={8}
                placeholder="Bijv.: Wij verkopen premium producten in Nederland. Klanten bellen vaak over levering en retour. Tone of voice: vriendelijk en direct."
                className="w-full min-h-[10rem] rounded-xl border border-border bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {updatedAt ? (
                <p className="text-xs text-text-secondary">
                  Laatst opgeslagen:{" "}
                  {new Date(updatedAt).toLocaleString("nl-NL")}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-error" role="alert">
                  {error}
                </p>
              ) : null}
              {saved ? (
                <p className="text-sm text-green-700 dark:text-green-400">
                  Opgeslagen — chat gebruikt de nieuwe context binnen een minuut.
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  size="touch"
                  className="w-full sm:w-auto"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  <Save className="h-5 w-5" aria-hidden />
                  {saving ? "Opslaan…" : "Opslaan"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="touch"
                  className="w-full sm:w-auto"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  <Eye className="h-5 w-5" aria-hidden />
                  {showPreview ? "Verberg voorbeeld" : "Toon voorbeeld in chat"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showPreview && !loading ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voorbeeld in chat</CardTitle>
            <CardDescription>
              Zo ziet de AI deze tekst in het systeembericht (vóór kennisbank).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewBlock ? (
              <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface-elevated/50 p-4 text-sm leading-relaxed text-text-primary">
                {previewBlock}
              </pre>
            ) : (
              <p className="text-sm text-text-secondary">
                Nog geen teamcontext — chat gebruikt alleen kennisbank en
                geheugen.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export { ROLE_LABELS };
