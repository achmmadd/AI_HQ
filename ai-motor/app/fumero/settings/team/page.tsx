"use client";

import Link from "next/link";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { TeamMembersPanel } from "@/components/settings/team-members-panel";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function FumeroSettingsTeamPage() {
  return (
    <FumeroShell page="Team & rollen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
        <SettingsNav />
        <TeamMembersPanel
          defaultWorkspace="fumero"
          allowedWorkspaces={["fumero"]}
          isAdmin
        />
        <p className="text-sm text-[var(--fumero-text-muted)]">
          Ook bereikbaar via{" "}
          <Link href="/settings/team" className="underline">
            /settings/team
          </Link>
          .
        </p>
      </div>
    </FumeroShell>
  );
}
