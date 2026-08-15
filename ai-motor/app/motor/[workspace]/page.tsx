import { renderMotorShell } from "../render-motor-shell";

/** Path-scoped Motor shell. Foreign workspaces fail closed on the server. */
export default async function MotorWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await params;
  return renderMotorShell({
    pathSegments: [workspace],
    query: await searchParams,
  });
}
