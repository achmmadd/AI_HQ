import {
  getRecentProjectSummariesForKlant,
  getProjectResumeNote,
} from "@/lib/project-resume";
import { formatUserContextBlock, maybeLearnFromPrompt } from "@/lib/motor-user-context";

export async function buildResumeContextBlock(
  klant: string,
  opts?: { activeProjectId?: number; userPrompt?: string }
): Promise<string> {
  if (opts?.userPrompt) {
    maybeLearnFromPrompt(klant, opts.userPrompt);
  }

  const profile = formatUserContextBlock(klant);
  const recent = getRecentProjectSummariesForKlant(klant, 4);

  let active = "";
  if (opts?.activeProjectId) {
    const note = getProjectResumeNote(opts.activeProjectId);
    if (note) {
      active = `\n### Actief project (hervat)\n${note}\n`;
    }
  }

  const recentBlock =
    recent.length > 0
      ? recent
          .map(
            (r, i) =>
              `${i + 1}. [project:${r.projectId}] ${r.title} — ${r.summary} (bijgewerkt ${r.updated_at})`
          )
          .join("\n")
      : "(geen recente projecten)";

  return (
    `### Gebruiker / doelen\n${profile}\n\n` +
    `### Recente projecten (hervat in chat via /chat?project=ID)\n${recentBlock}` +
    active
  );
}
