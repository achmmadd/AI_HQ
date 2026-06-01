import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  assertScrapeUrlAllowed,
  isScrapeConfigured,
  scrapeUrl,
  activeScrapeProviderLabel,
} from "@/lib/fumero/scrape-url";
import { upsertScrapedPageToKennisbank } from "@/lib/fumero/kennisbank-qdrant";

export const runtime = "nodejs";

type Body = {
  url?: string;
  reason?: string;
  upsert_qdrant?: boolean;
};

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Ongeldige JSON-body." },
      { status: 400 }
    );
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "api scrape_url";

  if (!url) {
    return NextResponse.json(
      { error: "url is verplicht (volledige https-link)." },
      { status: 400 }
    );
  }

  const deny = assertScrapeUrlAllowed(url);
  if (deny) {
    return NextResponse.json({ error: deny }, { status: 403 });
  }

  if (!isScrapeConfigured()) {
    return NextResponse.json(
      {
        error: "URL-reader is niet beschikbaar.",
        configured: false,
      },
      { status: 503 }
    );
  }

  const scrape = await scrapeUrl({ url, tenant: "fumero", reason });
  if (!scrape.ok) {
    return NextResponse.json(
      { error: scrape.error, url: scrape.url ?? url },
      { status: 502 }
    );
  }

  let qdrant: { upserted: number; collection: string } | { error: string } | null =
    null;
  if (body.upsert_qdrant) {
    qdrant = await upsertScrapedPageToKennisbank({ scrape });
  }

  return NextResponse.json({
    ok: true,
    url: scrape.url,
    markdown: scrape.markdown,
    truncated: scrape.truncated,
    fetched_at: scrape.fetchedAt,
    provider: scrape.provider,
    reader: activeScrapeProviderLabel(),
    reason,
    qdrant,
  });
}
