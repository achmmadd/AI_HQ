import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import db from "@/lib/db/database";
import { CustomAppPreview } from "@/components/custom-app-preview";
import { FumeroAppPreview } from "@/components/fumero/fumero-app-preview";
import { getPublishedBySlug } from "@/lib/fumero/tools-service";
import { getPublishedApp, getAppBySlug } from "@/lib/apps/apps-db";
import { requireWorkspacePage } from "@/lib/auth-guards";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export const runtime = "nodejs";

type Row = {
  naam: string;
  slug: string;
  code: string;
};

/** Type 2 — interne app (middleware vereist login) */
export default async function CustomAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const isPreview = sp.preview === "1";

  const fumero = getPublishedBySlug(slug);
  if (fumero && fumero.tool.deploy_type === "internal") {
    return (
      <FumeroAppPreview
        naam={fumero.tool.name}
        slug={fumero.tool.slug}
        code={fumero.version.code}
        status="published"
        type="internal"
      />
    );
  }

  const app = db
    .prepare(
      "SELECT naam, slug, code FROM custom_apps WHERE slug = ? AND status = 'live'"
    )
    .get(slug) as Row | undefined;

  // Fase 3/5: support published + (for preview) concept full-stack apps
  let newApp = getPublishedApp(slug);
  if (isPreview && !newApp) {
    // Fase 5: load concept app for live iframe preview in chat (uses session cookies for klant scoping)
    try {
      const token = (await cookies()).get(TOKEN_COOKIE)?.value;
      const session = await readAuthSession(token);
      if (session) {
        const previewKlant = session.scope === "all" ? "fumero" : session.scope;
        newApp = getAppBySlug(slug, previewKlant) ?? undefined;
      }
    } catch {}
  }
  if (newApp && newApp.type === "internal" && newApp.frontend_code) {
    if (newApp.auth_required && !isPreview) {
      await requireWorkspacePage("all", `/apps/${slug}`);
    }
    // Fase 5: ?preview=1 skips auth for chat iframe; renders echte app UI (even for concept during edit)
    return (
      <FumeroAppPreview
        naam={newApp.naam}
        slug={newApp.slug}
        code={newApp.frontend_code}
        status={newApp.status}
        type={newApp.type}
      />
    );
  }

  if (!app) notFound();

  return <CustomAppPreview naam={app.naam} slug={app.slug} code={app.code} />;
}
