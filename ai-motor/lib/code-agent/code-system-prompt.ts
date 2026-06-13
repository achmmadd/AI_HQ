import { getMotorDisciplineSuffix } from "@/lib/motor-discipline";
import { buildProgressiveCodeMemoryContext } from "@/lib/motor-memory";
import { readAutoContext } from "@/lib/code-workspace";
import fs from "fs/promises";
import { resolveFileAbs } from "@/lib/code-workspace";

export { getMotorCodeModel, resolveCodeModelForTurn } from "@/lib/code-agent/code-models";

export async function buildCodeSystemPrompt(opts: {
  klant: string;
  project: string;
  openFiles: string[];
  userMessage?: string;
  sessionId?: number | null;
}): Promise<string> {
  const autoContext = await readAutoContext(opts.klant, opts.project);
  let openFilesContext = "";
  for (const filePath of opts.openFiles.slice(0, 3)) {
    try {
      const abs = resolveFileAbs(opts.klant, opts.project, filePath);
      const content = await fs.readFile(abs, "utf-8");
      openFilesContext += `\n\n--- Open: ${filePath} ---\n${content.slice(0, 2500)}`;
    } catch {
      /* skip */
    }
  }

  const memoryBlock = opts.userMessage?.trim()
    ? await buildProgressiveCodeMemoryContext({
        query: opts.userMessage,
        klant: opts.klant,
        sessionId: opts.sessionId,
        project: opts.project,
      })
    : "";

  return `Je bent Motor AI Code — coding agent voor ${opts.klant}/${opts.project}.

Regels:
- Gebruik ALTIJD tools om bestanden te lezen/schrijven — beschrijf niet alleen wat je zou doen
- Na web-wijzigingen: voer npm run build of relevante verify uit als package.json bestaat
- Schrijf production-ready code, geen placeholders
- Als een commando faalt: lees output en fix
- Rapporteer aan het einde welke bestanden je hebt gewijzigd
- Nederlands tenzij de gebruiker Engels spreekt

${memoryBlock ? `${memoryBlock}\n\n` : ""}${autoContext}
${openFilesContext}

${getMotorDisciplineSuffix()}`;
}
