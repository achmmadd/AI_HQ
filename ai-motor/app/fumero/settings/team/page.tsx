"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { TeamMembersPanel } from "@/components/settings/team-members-panel";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function FumeroSettingsTeamPage() {
  return (
    <FumeroShell page="Team & rollen">
      <div className="flex w-full flex-col gap-6">
        <SettingsNav />
        <TeamMembersPanel
          defaultWorkspace="fumero"
          allowedWorkspaces={["fumero"]}
          isAdmin
        />
      </div>
    </FumeroShell>
  );
}
