import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { P1FoundationShell } from "@/components/p1/p1-foundation-shell";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";
import {
  collectRequestedWorkspaces,
  resolveMotorShell,
  type RequestedScope,
} from "@/pilot/p1-shell";

/** Server-side Motor shell gate. Query/path tokens never override tenant isolation. */
export async function renderMotorShell(requested: RequestedScope) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (!session) redirect("/login?from=%2Fmotor");

  const access = resolveMotorShell({
    authenticated: true,
    requested,
    defaultHomeWorkspace: collectRequestedWorkspaces(requested).length === 0,
  });
  if (!access.ok) redirect("/");
  return <P1FoundationShell view={access.view} />;
}
