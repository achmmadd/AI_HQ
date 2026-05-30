import { callCodeExecutor } from "@/lib/code-executor";
import {
  executorFilePath,
  executorProjectPath,
  IGNORED_DIRS,
} from "@/lib/code-workspace";
import {
  githubCreateRepo,
  githubGetLogin,
  githubPushFiles,
  githubRepoOwner,
  slugifyRepoName,
} from "@/lib/deploy-github";
import {
  isGithubRepoCreateBlocked,
  vercelCreateProjectFromGithub,
  vercelDeployFiles,
  vercelGetLatestDeployment,
  vercelResolveLiveUrl,
  type VercelDeployTarget,
} from "@/lib/deploy-vercel";

const MAX_FILES = 120;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export type DeployProjectResult = {
  live_url: string;
  repo_url: string;
  repo_full_name: string;
  deployment_id: string | null;
  files_pushed: number;
  environment: VercelDeployTarget;
};

async function listDirRecursive(
  klant: string,
  workspace: string,
  relDir: string,
  out: string[]
): Promise<void> {
  const listPath =
    relDir === "." || relDir === ""
      ? executorProjectPath(klant, workspace)
      : executorFilePath(klant, workspace, relDir);
  const r = await callCodeExecutor({ op: "list_dir", path: listPath });
  if (!r.ok) return;

  const entries = r.data?.entries;
  if (!Array.isArray(entries)) return;

  for (const entry of entries) {
    const name = String(entry);
    if (!name || name.includes("/")) continue;
    if (IGNORED_DIRS.has(name)) continue;

    const childRel =
      relDir === "." || relDir === "" ? name : `${relDir}/${name}`;

    const probe = await callCodeExecutor({
      op: "read_file",
      path: executorFilePath(klant, workspace, childRel),
    });
    if (probe.ok) {
      out.push(childRel);
      continue;
    }

    await listDirRecursive(klant, workspace, childRel, out);
  }
}

export async function readWorkspaceFiles(
  klant: string,
  workspace: string
): Promise<Record<string, string>> {
  const paths: string[] = [];
  await listDirRecursive(klant, workspace, ".", paths);

  const files: Record<string, string> = {};
  let totalBytes = 0;

  for (const rel of paths.sort()) {
    if (files[rel]) continue;
    const r = await callCodeExecutor({
      op: "read_file",
      path: executorFilePath(klant, workspace, rel),
    });
    if (!r.ok) continue;
    const content = String(r.data?.content ?? "");
    totalBytes += Buffer.byteLength(content, "utf8");
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        `Workspace te groot (> ${MAX_TOTAL_BYTES / (1024 * 1024)} MB)`
      );
    }
    files[rel] = content;
    if (Object.keys(files).length >= MAX_FILES) {
      throw new Error(`Te veel bestanden (max ${MAX_FILES})`);
    }
  }

  if (Object.keys(files).length === 0) {
    throw new Error("Geen deploybare bestanden in workspace");
  }

  return files;
}

async function deployViaVercelDirect(options: {
  slug: string;
  files: Record<string, string>;
  environment: VercelDeployTarget;
  vercelToken: string;
  teamId?: string;
}): Promise<DeployProjectResult> {
  const base = slugifyRepoName(options.slug);
  const projectName = `${base}-${Date.now().toString(36)}`;
  const deployed = await vercelDeployFiles({
    token: options.vercelToken,
    teamId: options.teamId,
    name: projectName,
    files: options.files,
    target: options.environment,
  });

  return {
    live_url: deployed.url,
    repo_url: "",
    repo_full_name: "",
    deployment_id: deployed.id,
    files_pushed: Object.keys(options.files).length,
    environment: options.environment,
  };
}

export async function deployCodeWorkspace(options: {
  klant: string;
  workspace: string;
  slug: string;
  environment: VercelDeployTarget;
  ghToken: string;
  vercelToken: string;
  teamId?: string;
  configOwner?: string;
}): Promise<DeployProjectResult> {
  const files = await readWorkspaceFiles(options.klant, options.workspace);

  const login = await githubGetLogin(options.ghToken);
  const { createUrl } = githubRepoOwner(options.configOwner, login);
  const base = slugifyRepoName(options.slug || options.workspace);
  const repoName = `${base}-${Date.now().toString(36)}`;

  let fullName: string;
  let defaultBranch: string;
  let pushed: number;

  try {
    const repo = await githubCreateRepo({
      token: options.ghToken,
      name: repoName,
      createUrl,
    });
    fullName = repo.fullName;
    defaultBranch = repo.defaultBranch;

    const pushResult = await githubPushFiles({
      token: options.ghToken,
      fullName,
      branch: defaultBranch,
      files,
      message: `Deploy code workspace ${options.klant}/${options.workspace}`,
    });
    pushed = pushResult.pushed;
  } catch (e) {
    if (!isGithubRepoCreateBlocked(e)) throw e;
    return deployViaVercelDirect({
      slug: options.slug || options.workspace,
      files,
      environment: options.environment,
      vercelToken: options.vercelToken,
      teamId: options.teamId,
    });
  }

  const vProjectName = repoName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const proj = await vercelCreateProjectFromGithub({
    token: options.vercelToken,
    teamId: options.teamId,
    name: vProjectName.slice(0, 48) || "motor-app",
    repoFullName: fullName,
  });

  const liveUrl = await vercelResolveLiveUrl({
    token: options.vercelToken,
    teamId: options.teamId,
    projectId: proj.id,
    projectName: proj.name,
    target: options.environment,
  });

  const latest = await vercelGetLatestDeployment({
    token: options.vercelToken,
    teamId: options.teamId,
    projectId: proj.id,
    target: options.environment,
  });

  return {
    live_url: liveUrl,
    repo_url: `https://github.com/${fullName}`,
    repo_full_name: fullName,
    deployment_id: latest?.id ?? null,
    files_pushed: pushed,
    environment: options.environment,
  };
}

export async function deployArtifactHtml(options: {
  slug: string;
  html: string;
  environment: VercelDeployTarget;
  ghToken: string;
  vercelToken: string;
  teamId?: string;
  configOwner?: string;
}): Promise<DeployProjectResult> {
  const idx = options.html.indexOf("<!DOCTYPE");
  const html =
    idx >= 0
      ? options.html.slice(idx)
      : options.html.trimStart().startsWith("<html")
        ? options.html
        : options.html;

  const login = await githubGetLogin(options.ghToken);
  const { createUrl } = githubRepoOwner(options.configOwner, login);
  const base = slugifyRepoName(options.slug);
  const repoName = `${base}-${Date.now().toString(36)}`;
  const fileMap = { "index.html": html };

  let fullName: string;
  let defaultBranch: string;
  let pushed: number;

  try {
    const repo = await githubCreateRepo({
      token: options.ghToken,
      name: repoName,
      createUrl,
    });
    fullName = repo.fullName;
    defaultBranch = repo.defaultBranch;

    const pushResult = await githubPushFiles({
      token: options.ghToken,
      fullName,
      branch: defaultBranch,
      files: fileMap,
      message: "Deploy: index.html from Motor AI",
    });
    pushed = pushResult.pushed;
  } catch (e) {
    if (!isGithubRepoCreateBlocked(e)) throw e;
    return deployViaVercelDirect({
      slug: options.slug,
      files: fileMap,
      environment: options.environment,
      vercelToken: options.vercelToken,
      teamId: options.teamId,
    });
  }

  const vProjectName = repoName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const proj = await vercelCreateProjectFromGithub({
    token: options.vercelToken,
    teamId: options.teamId,
    name: vProjectName.slice(0, 48) || "motor-app",
    repoFullName: fullName,
  });

  const liveUrl = await vercelResolveLiveUrl({
    token: options.vercelToken,
    teamId: options.teamId,
    projectId: proj.id,
    projectName: proj.name,
    target: options.environment,
  });

  const latest = await vercelGetLatestDeployment({
    token: options.vercelToken,
    teamId: options.teamId,
    projectId: proj.id,
    target: options.environment,
  });

  return {
    live_url: liveUrl,
    repo_url: `https://github.com/${fullName}`,
    repo_full_name: fullName,
    deployment_id: latest?.id ?? null,
    files_pushed: pushed,
    environment: options.environment,
  };
}
