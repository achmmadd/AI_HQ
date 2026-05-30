/**
 * Gedeeld studio-patroon voor Fumero / Bokas / Lab deep links.
 * Skin per workspace; Motor AI engine blijft gedeeld.
 */

export type StudioUrlParams = Record<string, string | undefined>;

export function buildStudioUrl(path: string, params: StudioUrlParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function studioChatUrl(workspacePath: string, prompt: string): string {
  const base = workspacePath.replace(/\/$/, "");
  return buildStudioUrl(`${base}/chat/workspace`, { q: prompt.trim() });
}

export function shouldStudioAutoRun(
  sp: { get: (key: string) => string | null },
  promptKey = "prompt"
): boolean {
  return sp.get("run") === "1" && Boolean(sp.get(promptKey)?.trim());
}

export function studioRunParams(
  prompt: string,
  extra?: StudioUrlParams
): StudioUrlParams {
  return { ...extra, prompt, run: "1" };
}
