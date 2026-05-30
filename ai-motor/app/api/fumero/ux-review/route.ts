import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { completeOpenRouterChat, isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";
import { anthropicComplete } from "@/lib/anthropic-messages";
import { getBuilderAnthropicModel } from "@/lib/fumero/builder-config";
import {
  formatUxChecklistMarkdown,
  runRuleBasedUxCheck,
} from "@/lib/connectors/specialists";
import {
  getConceptVersion,
  getPublishedVersion,
  getToolById,
  getToolBySlug,
} from "@/lib/fumero/tools-db";

export const runtime = "nodejs";

async function llmUxSummary(
  html: string,
  checklist: ReturnType<typeof runRuleBasedUxCheck>
): Promise<string | null> {
  const failed = checklist.items
    .filter((i) => !i.pass)
    .map((i) => `- ${i.label}: ${i.hint ?? ""}`)
    .join("\n");

  const prompt = [
    "Je bent een UX-tester voor Fumero webshop-widgets (NL).",
    `Rule-based score: ${checklist.score}/100.`,
    failed ? `Open punten:\n${failed}` : "Alle checklist-items slagen.",
    "Geef max 4 korte, actionable aanbevelingen in het Nederlands (bullets). Geen code.",
    "",
    "HTML (fragment):",
    html.slice(0, 12000),
  ].join("\n");

  try {
    if (process.env.MOTOR_BUILDER_USE_ANTHROPIC?.trim() === "1") {
      const { text } = await anthropicComplete({
        system: "Je bent een UX-tester voor Fumero webshop-widgets.",
        model: getBuilderAnthropicModel(),
        messages: [{ role: "user", content: prompt }],
        maxTokens: 600,
      });
      return text.trim() || null;
    }
    if (isOpenRouterDirectConfigured()) {
      const { message } = await completeOpenRouterChat({
        model:
          process.env.MOTOR_BUILDER_MODEL?.trim() ||
          "anthropic/claude-sonnet-4.6",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 600,
        signal: AbortSignal.timeout(45_000),
      });
      return message.trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    html?: string;
    slug?: string;
    toolId?: number | string;
    llm?: boolean;
  };

  let html = typeof body.html === "string" ? body.html.trim() : "";

  if (!html) {
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const toolIdRaw = body.toolId;
    const toolId =
      typeof toolIdRaw === "number"
        ? toolIdRaw
        : typeof toolIdRaw === "string"
          ? parseInt(toolIdRaw, 10)
          : NaN;
    const tool =
      (slug ? getToolBySlug(slug) : undefined) ??
      (!Number.isNaN(toolId) ? getToolById(toolId) : undefined);
    if (!tool) {
      return NextResponse.json({ error: "Tool niet gevonden" }, { status: 404 });
    }
    const version =
      getConceptVersion(tool.id) ?? getPublishedVersion(tool.id);
    html = version?.code?.trim() ?? "";
  }

  if (!html || html.length < 40) {
    return NextResponse.json(
      { error: "Geen HTML om te reviewen" },
      { status: 400 }
    );
  }

  const checklist = runRuleBasedUxCheck(html);
  const useLlm = body.llm !== false;
  const llmSummary = useLlm ? await llmUxSummary(html, checklist) : null;
  const markdown = formatUxChecklistMarkdown(
    checklist.items,
    checklist.score,
    llmSummary ?? undefined
  );

  return NextResponse.json({
    ok: true,
    score: checklist.score,
    items: checklist.items,
    summary: llmSummary,
    markdown,
  });
}
