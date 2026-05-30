const GITHUB_API = "https://api.github.com";

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

export async function githubGetLogin(token: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: GH_HEADERS(token),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`GitHub /user: ${res.status}`);
  }
  const u = (await res.json()) as { login?: string };
  if (!u.login) throw new Error("GitHub /user: geen login");
  return u.login;
}

/**
 * Bepaal waar de repo wordt aangemaakt: eigen account of org (GITHUB_OWNER).
 */
export function githubRepoOwner(
  configOwner: string | undefined,
  tokenLogin: string
): {
  owner: string;
  createUrl: string;
} {
  const o = configOwner?.trim();
  if (!o || o === tokenLogin) {
    return { owner: tokenLogin, createUrl: `${GITHUB_API}/user/repos` };
  }
  return { owner: o, createUrl: `${GITHUB_API}/orgs/${o}/repos` };
}

export async function githubCreateRepo(options: {
  token: string;
  name: string;
  createUrl: string;
}): Promise<{ fullName: string; defaultBranch: string }> {
  const res = await fetch(options.createUrl, {
    method: "POST",
    headers: { ...GH_HEADERS(options.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: options.name,
      description: "Motor AI deploy",
      private: true,
      auto_init: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub create repo: ${res.status} ${t.slice(0, 400)}`);
  }
  const repo = (await res.json()) as { full_name?: string; default_branch?: string };
  if (!repo.full_name) throw new Error("GitHub: geen full_name");
  return {
    fullName: repo.full_name,
    defaultBranch: repo.default_branch || "main",
  };
}

export async function githubPutIndexHtml(options: {
  token: string;
  fullName: string;
  branch: string;
  html: string;
  message?: string;
}): Promise<void> {
  const b64 = Buffer.from(options.html, "utf8").toString("base64");
  const res = await fetch(
    `${GITHUB_API}/repos/${options.fullName}/contents/index.html`,
    {
      method: "PUT",
      headers: { ...GH_HEADERS(options.token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: options.message ?? "Deploy: index.html from Motor AI",
        content: b64,
        branch: options.branch,
      }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub push index.html: ${res.status} ${t.slice(0, 400)}`);
  }
}

export function slugifyRepoName(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return s || "motor-app";
}

export type GithubWorkflowRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  html_url: string | null;
  head_branch: string | null;
  created_at: string | null;
};

export async function githubGetWorkflowRuns(options: {
  token: string;
  fullName: string;
  branch?: string;
  perPage?: number;
}): Promise<GithubWorkflowRun[]> {
  const params = new URLSearchParams();
  params.set("per_page", String(options.perPage ?? 5));
  if (options.branch?.trim()) params.set("branch", options.branch.trim());

  const res = await fetch(
    `${GITHUB_API}/repos/${options.fullName}/actions/runs?${params}`,
    {
      headers: GH_HEADERS(options.token),
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub workflow runs: ${res.status} ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    workflow_runs?: Array<{
      id?: number;
      status?: string;
      conclusion?: string;
      html_url?: string;
      head_branch?: string;
      created_at?: string;
    }>;
  };
  return (j.workflow_runs ?? []).map((r) => ({
    id: r.id ?? 0,
    status: r.status ?? null,
    conclusion: r.conclusion ?? null,
    html_url: r.html_url ?? null,
    head_branch: r.head_branch ?? null,
    created_at: r.created_at ?? null,
  }));
}

export async function githubPushFiles(options: {
  token: string;
  fullName: string;
  branch: string;
  files: Record<string, string>;
  message?: string;
}): Promise<{ pushed: number }> {
  const entries = Object.entries(options.files).filter(
    ([path]) => path && !path.endsWith("/")
  );
  if (entries.length === 0) {
    throw new Error("Geen bestanden om te pushen");
  }

  let pushed = 0;
  for (const [relPath, content] of entries) {
    const encodedPath = relPath
      .replace(/^\/+/, "")
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const url = `${GITHUB_API}/repos/${options.fullName}/contents/${encodedPath}?ref=${encodeURIComponent(options.branch)}`;
    let sha: string | undefined;
    const existing = await fetch(url, {
      headers: GH_HEADERS(options.token),
      signal: AbortSignal.timeout(30_000),
    });
    if (existing.ok) {
      const ej = (await existing.json()) as { sha?: string };
      sha = ej.sha;
    }

    const b64 = Buffer.from(content, "utf8").toString("base64");
    const res = await fetch(
      `${GITHUB_API}/repos/${options.fullName}/contents/${encodedPath}`,
      {
        method: "PUT",
        headers: {
          ...GH_HEADERS(options.token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message:
            options.message ??
            `Deploy: ${relPath} from Motor AI (${options.branch})`,
          content: b64,
          branch: options.branch,
          ...(sha ? { sha } : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(
        `GitHub push ${relPath}: ${res.status} ${t.slice(0, 400)}`
      );
    }
    pushed += 1;
  }
  return { pushed };
}
