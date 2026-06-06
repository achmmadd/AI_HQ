"use client";

import Link from "next/link";
import { BokasShell } from "@/components/bokas/bokas-shell";
import { MasterContextEditor } from "@/components/settings/master-context-editor";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function BokasSettingsContextPage() {
  return (
    <BokasShell page="Teamcontext">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <SettingsNav />
        <MasterContextEditor
          defaultWorkspace="bokas"
          allowedWorkspaces={["bokas"]}
        />
        <p className="text-sm text-text-secondary">
          Ook bereikbaar via{" "}
          <Link href="/settings/context" className="underline">
            /settings/context
          </Link>
          .
        </p>
      </div>
    </BokasShell>
  );
}
