import { isBuildLikePrompt } from "@/lib/build-intent-ext";
import {
  isProjectIterationPrompt,
  isProjectLikePrompt,
  isProjectStartPrompt,
} from "@/lib/build-intent-project";
import { isDesignArtifactPrompt } from "@/lib/intelligent-builder-gate";

export type MotorsChatAction =
  | { type: "chat" }
  | { type: "artifact" }
  | { type: "project-start" }
  | { type: "project-iterate" }
  | { type: "code-workspace" };

const QUESTION_RE =
  /^(wat|hoe|waarom|wie|when|what|how|why|leg\s+uit|uitleg|vertel|explain)\b/i;

const COMPLEX_BUILD_RE =
  /\b(react|next\.?js|nextjs|typescript|tsx|jsx|vite|motor\s*ai|motorsai|factory\s*os|api\s*route|database|prisma|auth|saas|platform|volledige\s*app|multi.?file|component|hooks|node\.?js|express|full.?stack)\b/i;

/** Multi-file / stack builds → code workspace, not artifact or lightweight project builder. */
export function isComplexBuildPrompt(prompt: string): boolean {
  return COMPLEX_BUILD_RE.test(prompt.trim());
}

const SIMPLE_WIDGET_RE =
  /\b(rekenmachine|calculator|timer|klok|todo|widget|countdown|stopwatch|counter|dice|dobbelsteen)\b/i;

/** Eén HTML-bestand: games en arcade — geen multi-file project in bouwen. */
const SINGLE_PAGE_GAME_RE =
  /\b(flappy|bird|game|spel|snake|pong|tetris|arcade|platformer|canvas\s*game|mini\s*game)\b/i;

/** Eén HTML-bestand: QR-menu, menukaart, landings — geen multi-file project. */
const SINGLE_FILE_HTML_RE =
  /\b(qr\s*menu|menukaart|digitale\s*menu|menu\s*kaart|één\s*html|een\s*html|single\s*file|één\s*bestand|srcdoc|iframe\s*app)\b/i;

/** Klein één-pagina HTML-widget → artifact; rest → multi-file project. */
export function shouldUseArtifactBuild(prompt: string): boolean {
  const t = prompt.trim();
  if (!t || COMPLEX_BUILD_RE.test(t)) return false;
  if (SINGLE_FILE_HTML_RE.test(t) && !COMPLEX_BUILD_RE.test(t)) return true;
  if (SINGLE_PAGE_GAME_RE.test(t) && !COMPLEX_BUILD_RE.test(t)) return true;
  if (isProjectLikePrompt(t) && !SIMPLE_WIDGET_RE.test(t) && !SINGLE_PAGE_GAME_RE.test(t)) {
    return false;
  }
  if (SIMPLE_WIDGET_RE.test(t) && t.length < 220) return true;
  if (isDesignArtifactPrompt(t) && t.length < 280 && !COMPLEX_BUILD_RE.test(t)) {
    return true;
  }
  return false;
}

/**
 * Eén chat bestuurt alles: chat, artifact of project — zonder ?mode= in de URL.
 */
export function resolveMotorsChatAction(opts: {
  prompt: string;
  hasActiveProject: boolean;
}): MotorsChatAction {
  const t = opts.prompt.trim();
  if (!t) return { type: "chat" };

  if (opts.hasActiveProject) {
    if (QUESTION_RE.test(t) && !isProjectIterationPrompt(t)) {
      return { type: "chat" };
    }
    if (
      isProjectIterationPrompt(t) ||
      isBuildLikePrompt(t) ||
      isProjectLikePrompt(t) ||
      t.length >= 8
    ) {
      return { type: "project-iterate" };
    }
    return { type: "chat" };
  }

  const wantsBuild =
    isProjectStartPrompt(t) ||
    isProjectLikePrompt(t) ||
    isBuildLikePrompt(t);

  if (!wantsBuild) return { type: "chat" };

  if (isComplexBuildPrompt(t)) return { type: "code-workspace" };
  if (shouldUseArtifactBuild(t)) return { type: "artifact" };
  return { type: "project-start" };
}

export function motorsActionLabel(action: MotorsChatAction): string | null {
  switch (action.type) {
    case "artifact":
      return "App bouwen…";
    case "project-start":
      return "Project coderen…";
    case "project-iterate":
      return "Project bijwerken…";
    case "code-workspace":
      return "Code workspace…";
    default:
      return null;
  }
}
