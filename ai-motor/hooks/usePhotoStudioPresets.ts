"use client";

import { useMemo } from "react";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { resolvePhotoStudioDefaults } from "@/lib/photo-studio/workspace-presets";

export function usePhotoStudioPresets() {
  const workspace = useCompanyStore((s) => s.workspace);
  return useMemo(() => resolvePhotoStudioDefaults(workspace), [workspace]);
}
