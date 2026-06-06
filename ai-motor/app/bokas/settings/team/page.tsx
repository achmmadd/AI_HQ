"use client";

import Link from "next/link";
import { BokasShell } from "@/components/bokas/bokas-shell";
import { TeamMembersPanel } from "@/components/settings/team-members-panel";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function BokasSettingsTeamPage() {
  return (
    <BokasShell page="Team & rollen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <SettingsNav />
        <TeamMembersPanel
          defaultWorkspace="bokas"
          allowedWorkspaces={["bokas"]}
          isAdmin
        />
        <p className="text-sm text-text-secondary">
          Ook bereikbaar via{" "}
          <Link href="/settings/team" className="underline">
            /settings/team
          </Link>
          .
        </p>
      </div>
    </BokasShell>
  );
}
