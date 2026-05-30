"use client";

import { useCallback, useState } from "react";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import type { ChatKlant } from "@/lib/types";
import type { ProjectFiles, ProjectSpec } from "@/lib/project-types";
import { buildProjectPreviewHtml } from "@/lib/project-preview-html";
import { detectProjectStack } from "@/lib/project-stack";

export type ProjectState = {
  id: number;
  slug: string;
  title: string;
  spec: ProjectSpec;
  files: ProjectFiles;
  previewHtml: string;
};

type ProjectPayload = {
  error?: string;
  hint?: string;
  id?: number;
  slug?: string;
  title?: string;
  spec?: ProjectSpec;
  files?: ProjectFiles;
};

const jsonOpts = { credentials: "include" as const };

export function useProject(klant: ChatKlant) {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPayload = useCallback(
    (data: {
      id: number;
      slug: string;
      title: string;
      spec: ProjectSpec;
      files: ProjectFiles;
    }) => {
      setProject({
        id: data.id,
        slug: data.slug,
        title: data.title,
        spec: data.spec,
        files: data.files,
        previewHtml: buildProjectPreviewHtml(
          data.files,
          data.spec.stack ?? detectProjectStack("", data.spec)
        ),
      });
    },
    []
  );

  const buildProject = useCallback(
    async (prompt: string, conversationId?: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJsonChecked<ProjectPayload>("/api/project/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...jsonOpts,
          body: JSON.stringify({
            prompt,
            klant,
            conversation_id: conversationId,
          }),
        });
        if (!data.id || !data.files || !data.spec) {
          throw new Error("Onvolledig project-antwoord");
        }
        applyPayload({
          id: data.id,
          slug: data.slug ?? `project-${data.id}`,
          title: data.title ?? data.spec.title,
          spec: data.spec,
          files: data.files,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Project starten mislukt";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [klant, applyPayload]
  );

  const iterateProject = useCallback(
    async (instruction: string) => {
      if (!project) throw new Error("Geen actief project");
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJsonChecked<ProjectPayload>("/api/project/iterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...jsonOpts,
          body: JSON.stringify({
            project_id: project.id,
            instruction,
            klant,
          }),
        });
        if (!data.files || !data.spec) {
          throw new Error("Onvolledig patch-antwoord");
        }
        applyPayload({
          id: project.id,
          slug: data.slug ?? project.slug,
          title: data.title ?? project.title,
          spec: data.spec,
          files: data.files,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Project bijwerken mislukt";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [klant, project, applyPayload]
  );

  const closeProject = useCallback(() => {
    setProject(null);
    setError(null);
  }, []);

  const loadProject = useCallback(
    async (projectId: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJsonChecked<ProjectPayload>(
          `/api/project/${projectId}`,
          jsonOpts
        );
        if (!data.id || !data.files || !data.spec) {
          throw new Error(data.error || "Project laden mislukt");
        }
        applyPayload({
          id: data.id,
          slug: data.slug ?? `project-${data.id}`,
          title: data.title ?? data.spec.title,
          spec: data.spec,
          files: data.files,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Project laden mislukt";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [applyPayload]
  );

  const saveProjectAsApp = useCallback(async () => {
    if (!project) return;
    await fetchJsonChecked<{ ok?: boolean; error?: string }>(
      "/api/project/save-as-app",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...jsonOpts,
        body: JSON.stringify({
          project_id: project.id,
          klant,
        }),
      }
    );
  }, [project, klant]);

  return {
    project,
    loading,
    error,
    buildProject,
    iterateProject,
    closeProject,
    saveProjectAsApp,
    loadProject,
  };
}
