"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { MasterContextEditor } from "@/components/settings/master-context-editor";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function FumeroSettingsContextPage() {
  return (
    <FumeroShell page="Teamcontext">
      <div className="flex w-full flex-col gap-6">
        <SettingsNav />
        <MasterContextEditor
          defaultWorkspace="fumero"
          allowedWorkspaces={["fumero"]}
        />
      </div>
    </FumeroShell>
  );
}
