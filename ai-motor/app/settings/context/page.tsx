import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings/settings-nav";
import { MasterContextEditor } from "@/components/settings/master-context-editor";
import { readAuthSession, TOKEN_COOKIE, type WorkspaceScope } from "@/lib/auth-session";

function allowedWorkspaces(scope: WorkspaceScope): ("fumero" | "bokas" | "personal")[] {
  if (scope === "all") return ["fumero", "bokas", "personal"];
  if (scope === "fumero" || scope === "bokas" || scope === "personal") {
    return [scope];
  }
  return ["personal"];
}

export default async function SettingsContextPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (!session) {
    redirect("/login?from=/settings/context");
  }

  const workspaces = allowedWorkspaces(session.scope);

  return (
    <AppShell title="Instellingen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <SettingsNav />
        <MasterContextEditor
          defaultWorkspace={workspaces[0]}
          allowedWorkspaces={workspaces}
        />
      </div>
    </AppShell>
  );
}
