"use client";

import Link from "next/link";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { MasterContextEditor } from "@/components/settings/master-context-editor";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function FumeroSettingsContextPage() {
  return (
    <FumeroShell page="Teamcontext">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
        <SettingsNav />
        <MasterContextEditor
          defaultWorkspace="fumero"
          allowedWorkspaces={["fumero"]}
        />
        <p className="text-sm text-[var(--fumero-text-muted)]">
          Ook bereikbaar via{" "}
          <Link href="/settings/context" className="underline">
            /settings/context
          </Link>
          .
        </p>
      </div>
    </FumeroShell>
  );
}
