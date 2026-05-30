import { assertDifyConfigured } from "@/lib/artifact-html";
import { generateArtifactHtml } from "@/lib/artifact-generate";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import { filesJsonHint } from "@/lib/project-generate-hints";
import { buildProjectBuildPreamble } from "@/lib/project-preamble";
import { defaultProjectScaffold } from "@/lib/project-scaffold";
import { parseProjectSpec } from "@/lib/project-spec";
import {
  detectProjectStack,
  projectHasEntry,
  type ProjectStack,
} from "@/lib/project-stack";
import type { ProjectFiles, ProjectSpec } from "@/lib/project-types";

function extractFilesJson(text: string): ProjectFiles | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      files?: ProjectFiles;
    };
    const files = parsed.files ?? (parsed as unknown as ProjectFiles);
    if (!files || typeof files !== "object") return null;
    const out: ProjectFiles = {};
    for (const [k, v] of Object.entries(files)) {
      if (typeof v === "string" && v.trim()) out[k.replace(/^\//, "")] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function splitHtmlToFiles(html: string): ProjectFiles {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const scriptMatch = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i);
  let indexHtml = html;
  if (styleMatch) {
    indexHtml = indexHtml.replace(styleMatch[0], "");
  }
  if (scriptMatch) {
    indexHtml = indexHtml.replace(scriptMatch[0], "");
  }
  if (!indexHtml.includes('href="styles.css"')) {
    indexHtml = indexHtml.replace("</head>", '  <link rel="stylesheet" href="styles.css">\n</head>');
  }
  if (!indexHtml.includes('src="app.js"')) {
    indexHtml = indexHtml.replace("</body>", '  <script src="app.js"></script>\n</body>');
  }
  return {
    "index.html": indexHtml.trim(),
    "styles.css": styleMatch?.[1]?.trim() ?? "",
    "app.js": scriptMatch?.[1]?.trim() ?? "",
  };
}

function hintForSpec(spec: ProjectSpec): string {
  const stack = spec.stack ?? "vanilla";
  return filesJsonHint(stack);
}

function filesValid(files: ProjectFiles | null, stack: ProjectStack): boolean {
  return Boolean(files && projectHasEntry(files, stack));
}

async function generateFilesViaN8n(
  spec: ProjectSpec,
  prompt: string,
  klant: string,
  preamble: string
): Promise<ProjectFiles | null> {
  const hint = hintForSpec(spec);
  const { ok, data } = await callFactoryN8n({
    prompt:
      preamble +
      hint +
      `\n\nStack: ${spec.stack}\nSpecificatie:\n${JSON.stringify(spec)}\n\nPrompt:\n${prompt}`,
    klant,
    afdeling: "fabriek",
    intent: "build",
    type: "project_files",
  });
  if (!ok) return null;
  return extractFilesJson(extractMessage(data));
}

async function generateFilesViaDify(
  spec: ProjectSpec,
  prompt: string,
  klant: string
): Promise<ProjectFiles | null> {
  if (!assertDifyConfigured()) return null;
  const hint = hintForSpec(spec);
  const fullPrompt = `${hint}\n\nBouw multi-file project (${spec.stack}).\nSpecificatie: ${JSON.stringify(spec)}\n\n${prompt}`;
  const { html, error } = await generateArtifactHtml(fullPrompt, klant, "fabriek", 2);
  if (!html || error) return null;
  const asJson = extractFilesJson(html);
  if (asJson) return asJson;
  return splitHtmlToFiles(html);
}

async function generateProjectFiles(
  spec: ProjectSpec,
  prompt: string,
  klant: string
): Promise<ProjectFiles> {
  const stack = spec.stack ?? detectProjectStack(prompt, spec);
  spec.stack = stack;
  const preamble = await buildProjectBuildPreamble(klant, prompt);

  if (assertDifyConfigured()) {
    const files = await generateFilesViaDify(spec, prompt, klant);
    if (filesValid(files, stack)) return files!;
  }

  const files = await generateFilesViaN8n(spec, prompt, klant, preamble);
  if (filesValid(files, stack)) return files!;

  return defaultProjectScaffold(spec, stack);
}

export async function createProjectFromPrompt(opts: {
  prompt: string;
  klant: string;
  conversationId?: number | null;
}): Promise<{
  spec: ProjectSpec;
  files: ProjectFiles;
}> {
  const spec = await parseProjectSpec(opts.prompt, opts.klant);
  spec.stack = detectProjectStack(opts.prompt, spec);
  const files = await generateProjectFiles(spec, opts.prompt, opts.klant);
  return { spec, files };
}

export async function patchProjectFiles(opts: {
  spec: ProjectSpec;
  files: ProjectFiles;
  instruction: string;
  klant: string;
  projectId?: number;
}): Promise<ProjectFiles> {
  const stack = opts.spec.stack ?? detectProjectStack(opts.instruction, opts.spec);
  opts.spec.stack = stack;
  const preamble = await buildProjectBuildPreamble(
    opts.klant,
    opts.instruction,
    opts.projectId
  );
  const context = JSON.stringify(
    { spec: opts.spec, files: opts.files },
    null,
    2
  ).slice(0, 80_000);

  const patchHint = `Pas het bestaande project aan volgens de instructie. ${hintForSpec(opts.spec)}
Geef het VOLLEDIGE bijgewerkte files-object terug (alle bestanden).`;

  const { ok, data } = await callFactoryN8n({
    prompt: preamble + patchHint + `\n\nHuidige:\n${context}\n\nInstructie:\n${opts.instruction}`,
    klant: opts.klant,
    afdeling: "fabriek",
    intent: "build",
    type: "project_patch",
  });
  if (ok) {
    const patched = extractFilesJson(extractMessage(data));
    if (filesValid(patched, stack)) return patched!;
  }

  return opts.files;
}
