import { notFound } from "next/navigation";
import db from "@/lib/db/database";
import { CustomAppPreview } from "@/components/custom-app-preview";

export const runtime = "nodejs";

type Row = {
  naam: string;
  slug: string;
  code: string;
};

export default async function CustomAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const app = db
    .prepare(
      "SELECT naam, slug, code FROM custom_apps WHERE slug = ? AND status = 'live'"
    )
    .get(slug) as Row | undefined;

  if (!app) notFound();

  return (
    <CustomAppPreview naam={app.naam} slug={app.slug} code={app.code} />
  );
}
