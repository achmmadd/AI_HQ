import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { TeamMembersPanel } from "@/components/settings/team-members-panel";
import { readAuthSession, TOKEN_COOKIE, type WorkspaceScope } from "@/lib/auth-session";

function allowedWorkspaces(scope: WorkspaceScope): ("fumero" | "bokas" | "personal")[] {
  if (scope === "all") return ["fumero", "bokas", "personal"];
  if (scope === "fumero" || scope === "bokas" || scope === "personal") {
    return [scope];
  }
  return ["personal"];
}

export default async function SettingsTeamPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (!session) {
    redirect("/login?from=/settings/team");
  }

  const workspaces = allowedWorkspaces(session.scope);
  const isAdmin =
    session.role === "admin" || session.membershipRole === "admin";

  return (
    <AppShell title="Team & rollen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <SettingsNav />
        <SettingsPageHeader
          title="Team & rollen"
          description="Beheer wie toegang heeft tot je workspace en welke rechten ze hebben."
        />
        <TeamMembersPanel
          defaultWorkspace={workspaces[0]}
          allowedWorkspaces={workspaces}
          membershipRole={session.membershipRole ?? null}
          isAdmin={isAdmin}
        />
      </div>
    </AppShell>
  );
}
