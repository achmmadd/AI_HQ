const VERCEL_API = "https://api.vercel.com";

function vercelHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function vercelCreateProjectFromGithub(options: {
  token: string;
  teamId?: string;
  /** Vercel project name (unique binnen account) */
  name: string;
  /** owner/repo */
  repoFullName: string;
}): Promise<{ id: string; name: string }> {
  const params = new URLSearchParams();
  if (options.teamId?.trim()) params.set("teamId", options.teamId.trim());
  const q = params.toString() ? `?${params}` : "";

  const res = await fetch(`${VERCEL_API}/v10/projects${q}`, {
    method: "POST",
    headers: vercelHeaders(options.token),
    body: JSON.stringify({
      name: options.name,
      framework: null,
      gitRepository: {
        type: "github",
        repo: options.repoFullName,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Vercel create project: ${res.status} ${t.slice(0, 500)}`);
  }
  const j = (await res.json()) as { id?: string; name?: string };
  if (!j.id || !j.name) throw new Error("Vercel: onverwacht project-response");
  return { id: j.id, name: j.name };
}

export type VercelDeployTarget = "production" | "preview";

/**
 * Live URL van laatste deployment (production of preview), anders fallback *.vercel.app.
 */
export async function vercelResolveLiveUrl(options: {
  token: string;
  teamId?: string;
  projectId: string;
  projectName: string;
  target?: VercelDeployTarget;
}): Promise<string> {
  const target = options.target ?? "production";
  const params = new URLSearchParams();
  params.set("projectId", options.projectId);
  params.set("target", target);
  params.set("limit", "5");
  if (options.teamId?.trim()) params.set("teamId", options.teamId.trim());

  const res = await fetch(`${VERCEL_API}/v6/deployments?${params}`, {
    headers: vercelHeaders(options.token),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.ok) {
    const j = (await res.json()) as {
      deployments?: Array<{ url?: string; id?: string }>;
    };
    const d = j.deployments?.[0];
    if (d?.url) return `https://${d.url}`;
  }
  if (target === "preview") {
    return `https://${options.projectName}-git-main.vercel.app`;
  }
  return `https://${options.projectName}.vercel.app`;
}

export async function vercelGetLatestDeployment(options: {
  token: string;
  teamId?: string;
  projectId: string;
  target?: VercelDeployTarget;
}): Promise<{ id: string; url: string } | null> {
  const params = new URLSearchParams();
  params.set("projectId", options.projectId);
  params.set("target", options.target ?? "production");
  params.set("limit", "1");
  if (options.teamId?.trim()) params.set("teamId", options.teamId.trim());

  const res = await fetch(`${VERCEL_API}/v6/deployments?${params}`, {
    headers: vercelHeaders(options.token),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    deployments?: Array<{ id?: string; url?: string }>;
  };
  const d = j.deployments?.[0];
  if (!d?.id || !d.url) return null;
  return { id: d.id, url: `https://${d.url}` };
}

/** Deploy bestanden direct naar Vercel (zonder GitHub-repo). */
export async function vercelDeployFiles(options: {
  token: string;
  teamId?: string;
  name: string;
  files: Record<string, string>;
  target?: VercelDeployTarget;
}): Promise<{ id: string; url: string }> {
  const params = new URLSearchParams();
  if (options.teamId?.trim()) params.set("teamId", options.teamId.trim());
  const q = params.toString() ? `?${params}` : "";

  const fileEntries = Object.entries(options.files)
    .filter(([path]) => path && !path.endsWith("/"))
    .map(([file, data]) => ({
      file: file.replace(/^\/+/, ""),
      data,
    }));

  if (fileEntries.length === 0) {
    throw new Error("Geen bestanden om te deployen naar Vercel");
  }

  const projectName =
    options.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 48) ||
    "motor-app";

  const res = await fetch(`${VERCEL_API}/v13/deployments${q}`, {
    method: "POST",
    headers: vercelHeaders(options.token),
    body: JSON.stringify({
      name: projectName,
      files: fileEntries,
      projectSettings: { framework: null },
      target: options.target === "preview" ? "preview" : "production",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Vercel direct deploy: ${res.status} ${t.slice(0, 500)}`);
  }

  const j = (await res.json()) as { id?: string; url?: string };
  if (!j.id || !j.url) {
    throw new Error("Vercel direct deploy: onverwacht response");
  }
  return { id: j.id, url: j.url.startsWith("http") ? j.url : `https://${j.url}` };
}

export function isGithubRepoCreateBlocked(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("403") ||
    msg.includes("resource not accessible by personal access token") ||
    msg.includes("create repo")
  );
}

export async function vercelRollbackDeployment(options: {
  token: string;
  teamId?: string;
  deploymentId: string;
}): Promise<{ url: string }> {
  const params = new URLSearchParams();
  if (options.teamId?.trim()) params.set("teamId", options.teamId.trim());
  const q = params.toString() ? `?${params}` : "";

  const res = await fetch(
    `${VERCEL_API}/v13/deployments/${options.deploymentId}/rollback${q}`,
    {
      method: "POST",
      headers: vercelHeaders(options.token),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Vercel rollback: ${res.status} ${t.slice(0, 400)}`);
  }
  const j = (await res.json()) as { url?: string };
  if (j.url) return { url: j.url.startsWith("http") ? j.url : `https://${j.url}` };
  return { url: "" };
}
