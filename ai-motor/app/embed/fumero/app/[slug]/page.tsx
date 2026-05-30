import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { FumeroEmbedFrame } from "@/components/fumero/fumero-embed-frame";
import { getPublishedBySlug } from "@/lib/fumero/tools-service";
import { getPublishedApp, getAppBySlug } from "@/lib/apps/apps-db";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export const runtime = "nodejs";

/** Type 3 — publieke klantpagina (chrome-loze, full-bleed render) */
export default async function FumeroCustomerAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const isPreview = sp.preview === "1";

  const published = getPublishedBySlug(slug);
  if (published && published.tool.deploy_type === "customer") {
    return (
      <FumeroEmbedFrame
        naam={published.tool.name}
        code={published.version.code}
      />
    );
  }

  // Fase 3/5: support published + (for preview) concept customer full-stack apps
  let newApp = getPublishedApp(slug);
  if (isPreview && !newApp) {
    // Fase 5: load concept app for live iframe preview in chat (session cookies for klant)
    try {
      const token = (await cookies()).get(TOKEN_COOKIE)?.value;
      const session = await readAuthSession(token);
      if (session) {
        const previewKlant = session.scope === "all" ? "fumero" : session.scope;
        newApp = getAppBySlug(slug, previewKlant) ?? undefined;
      }
    } catch {}
  }
  if (newApp && newApp.type === "customer" && newApp.frontend_code) {
    // Fase 5: ?preview=1 supported for chat iframe (renders echte app, even concept during edit)
    return <FumeroEmbedFrame naam={newApp.naam} code={newApp.frontend_code} />;
  }

  notFound();
}
