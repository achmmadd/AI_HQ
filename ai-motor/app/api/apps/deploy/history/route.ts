import { NextRequest, NextResponse } from "next/server";
import { listDeployHistory } from "@/lib/deploy-history";
import { TOKEN_COOKIE, isValidSessionTokenStrict } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!(await isValidSessionTokenStrict(token))) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const klant = sp.get("klant")?.trim() || undefined;
  const slug = sp.get("slug")?.trim() || undefined;
  const limit = Number(sp.get("limit") ?? "50");
  const rows = listDeployHistory({ klant, slug, limit });
  return NextResponse.json({ history: rows });
}
