import { notFound } from "next/navigation";
import { FumeroEmbedFrame } from "@/components/fumero/fumero-embed-frame";
import { getToolById, getVersion } from "@/lib/fumero/tools-db";

export const runtime = "nodejs";

/** Live preview — chrome-loze render van een specifieke versie. */
export default async function FumeroToolPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; version?: string }>;
}) {
  const sp = await searchParams;
  const toolId = parseInt(String(sp.tool ?? ""), 10);
  const versionId = parseInt(String(sp.version ?? ""), 10);
  if (Number.isNaN(toolId) || Number.isNaN(versionId)) notFound();

  const tool = getToolById(toolId);
  const version = getVersion(versionId);
  if (!tool || !version || version.tool_id !== tool.id) notFound();

  return (
    <FumeroEmbedFrame
      naam={`${tool.name} · v${version.version}`}
      code={version.code}
    />
  );
}
