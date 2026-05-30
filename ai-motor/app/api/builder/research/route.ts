import { NextRequest, NextResponse } from "next/server";
import {
  researchDesignPatterns,
  extractUrlsFromText,
} from "@/lib/builder-research";
import { qualifiesForIntelligentBuilder } from "@/lib/intelligent-builder-gate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const request =
    typeof body?.request === "string"
      ? body.request.trim()
      : typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";
  const klant =
    typeof body?.workspace_id === "string" && body.workspace_id
      ? body.workspace_id
      : typeof body?.klant === "string" && body.klant
        ? body.klant
        : "fumero";

  const includeRaw = body?.include_links;
  const includeLinks = Array.isArray(includeRaw)
    ? includeRaw.filter((x: unknown): x is string => typeof x === "string")
    : typeof includeRaw === "string"
      ? [includeRaw]
      : [];

  const fromText = extractUrlsFromText(request);
  const mergedLinks = [...new Set([...includeLinks, ...fromText])];

  if (!request) {
    return NextResponse.json({ error: "request required" }, { status: 400 });
  }

  if (!qualifiesForIntelligentBuilder(request)) {
    return NextResponse.json(
      {
        error:
          "Prompt voldoet niet aan builder/design-onderzoek (gebruik bv. ‘bouw’, ‘gallery’, of een link).",
      },
      { status: 400 }
    );
  }

  try {
    const r = await researchDesignPatterns({
      request,
      includeLinks: mergedLinks,
      klant,
    });
    return NextResponse.json({
      inspiration: {
        sources: r.sources,
        patterns: r.patterns,
        colors: r.colors,
        analysis: r.analysis,
      },
      prompt_suffix: r.promptSuffix,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
