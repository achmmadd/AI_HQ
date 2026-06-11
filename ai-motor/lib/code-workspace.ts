import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import type { CompanyId } from "@/lib/types";
import { isInternalCodeProject } from "@/lib/fumero/internal-project";

const execFileAsync = promisify(execFile);

export const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "__pycache__",
  ".DS_Store",
  "dist",
  "build",
  ".turbo",
]);

export type CodeTreeNode = {
  type: "file" | "directory";
  name: string;
  path: string;
  children?: CodeTreeNode[];
};

export type CodeWorkspaceInfo = {
  id: string;
  name: string;
  klant: CompanyId;
  executorPath: string;
};

export function getWorkspaceRoot(): string {
  const raw =
    process.env.LOCAL_WORKSPACE_ROOT?.trim() ||
    path.join(os.homedir(), "AI_HQ", "projects");
  return path.resolve(raw);
}

export function parseCodeKlant(raw: string | null | undefined): CompanyId {
  const k = raw?.trim().toLowerCase();
  if (k === "bokas" || k === "fumero") return k;
  return "fumero";
}

export function validateProjectSlug(name: string): boolean {
  return /^[a-z0-9_-]+$/.test(name) && name.length >= 1 && name.length <= 64;
}

/** Alias used by code session routes. */
export const isValidWorkspaceSlug = validateProjectSlug;

/** Executor-relative path: `{klant}/{project}/...` */
export function executorProjectPath(klant: string, project: string): string {
  return `${klant}/${project}`;
}

export function executorFilePath(
  klant: string,
  project: string,
  relPath: string
): string {
  const clean = relPath.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${executorProjectPath(klant, project)}/${clean}`;
}

export function resolveKlantAbs(klant: string): string {
  const root = getWorkspaceRoot();
  const abs = path.resolve(root, klant);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("path traversal");
  }
  return abs;
}

export function resolveProjectAbs(klant: string, project: string): string {
  if (!validateProjectSlug(project)) throw new Error("invalid project slug");
  const klantAbs = resolveKlantAbs(klant);
  const abs = path.resolve(klantAbs, project);
  if (!abs.startsWith(klantAbs + path.sep)) throw new Error("path traversal");
  return abs;
}

export function resolveFileAbs(
  klant: string,
  project: string,
  relPath: string
): string {
  const projectAbs = resolveProjectAbs(klant, project);
  const abs = path.resolve(projectAbs, relPath);
  if (!abs.startsWith(projectAbs + path.sep) && abs !== projectAbs) {
    throw new Error("path traversal");
  }
  return abs;
}

export async function ensureKlantDir(klant: CompanyId): Promise<void> {
  await fs.mkdir(resolveKlantAbs(klant), { recursive: true });
}

export async function listWorkspaces(klant: CompanyId): Promise<CodeWorkspaceInfo[]> {
  await ensureKlantDir(klant);
  const klantAbs = resolveKlantAbs(klant);
  let entries: string[] = [];
  try {
    const dirents = await fs.readdir(klantAbs, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  return entries
    .filter((name) => validateProjectSlug(name) && !isInternalCodeProject(name))
    .sort()
    .map((name) => ({
      id: name,
      name,
      klant,
      executorPath: executorProjectPath(klant, name),
    }));
}

export async function createWorkspace(
  klant: CompanyId,
  name: string
): Promise<CodeWorkspaceInfo> {
  const slug = name.trim().toLowerCase();
  if (!validateProjectSlug(slug)) {
    throw new Error("Ongeldige naam (alleen a-z, 0-9, - _)");
  }
  await ensureKlantDir(klant);
  const projectAbs = resolveProjectAbs(klant, slug);
  await fs.mkdir(projectAbs, { recursive: true });
  const readme = path.join(projectAbs, "README.md");
  try {
    await fs.access(readme);
  } catch {
    await fs.writeFile(
      readme,
      `# ${slug}\n\nProject aangemaakt via Motor AI /code (${klant})\n`,
      "utf-8"
    );
  }
  return {
    id: slug,
    name: slug,
    klant,
    executorPath: executorProjectPath(klant, slug),
  };
}

async function buildTreeDir(dirAbs: string, rootAbs: string): Promise<CodeTreeNode[]> {
  let dirents;
  try {
    dirents = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes: CodeTreeNode[] = [];
  for (const d of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED_DIRS.has(d.name)) continue;
    const full = path.join(dirAbs, d.name);
    const rel = path.relative(rootAbs, full).replace(/\\/g, "/");
    if (d.isDirectory()) {
      nodes.push({
        type: "directory",
        name: d.name,
        path: rel,
        children: await buildTreeDir(full, rootAbs),
      });
    } else if (d.isFile()) {
      nodes.push({ type: "file", name: d.name, path: rel });
    }
  }
  return nodes;
}

export async function buildFileTree(
  klant: string,
  project: string
): Promise<CodeTreeNode[]> {
  const rootAbs = resolveProjectAbs(klant, project);
  return buildTreeDir(rootAbs, rootAbs);
}

export async function searchCodebase(
  klant: string,
  project: string,
  query: string,
  filePattern = "*"
): Promise<string> {
  const projectAbs = resolveProjectAbs(klant, project);
  const q = query.trim().slice(0, 200);
  if (!q) return "Geen zoekterm";
  try {
    const { stdout } = await execFileAsync(
      "grep",
      [
        "-r",
        q,
        ".",
        "--include",
        filePattern,
        "-l",
        "--exclude-dir=node_modules",
        "--exclude-dir=.git",
        "--exclude-dir=.next",
      ],
      { cwd: projectAbs, timeout: 15_000, maxBuffer: 256_000 }
    );
    return stdout.trim() || "Geen resultaten gevonden";
  } catch (e: unknown) {
    const err = e as { stdout?: string; code?: number };
    if (err.code === 1) return "Geen resultaten gevonden";
    return err.stdout?.trim() || "Geen resultaten gevonden";
  }
}

export async function readAutoContext(
  klant: string,
  project: string
): Promise<string> {
  const files = ["README.md", "package.json"];
  let out = "";
  for (const f of files) {
    try {
      const abs = resolveFileAbs(klant, project, f);
      const content = await fs.readFile(abs, "utf-8");
      out += `\n\n--- ${f} ---\n${content.slice(0, 800)}`;
    } catch {
      /* skip */
    }
  }
  return out;
}
