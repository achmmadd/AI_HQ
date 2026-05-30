"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeployButton } from "@/components/DeployButton";
import { cn } from "@/lib/utils";

type PlatformStatus = {
  openrouter?: { configured: boolean; ok: boolean; latency_ms?: number };
  executor?: {
    nuc?: { configured: boolean; reachable: boolean };
    bridge?: { configured: boolean; online: boolean };
    active?: string;
  };
  deploy?: { ready: boolean; missing?: string[] };
};

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        ok ? "bg-green-500" : "bg-red-500"
      )}
    />
  );
}

/**
 * Dev panel sectie voor deploy readiness + smoke deploy.
 * Gebruik in pietje-owned wrappers; dev/page.tsx kan deze importeren.
 */
export function DevDeployPanel() {
  const [status, setStatus] = useState<PlatformStatus | null>(null);

  const load = useCallback(async () => {
    const [platRes, deployRes] = await Promise.all([
      fetch("/api/admin/platform-status", { credentials: "include" }),
      fetch("/api/apps/deploy", { credentials: "include" }),
    ]);
    const plat = (await platRes.json()) as PlatformStatus;
    const dep = (await deployRes.json()) as { ready?: boolean; missing?: string[] };
    setStatus({
      ...plat,
      deploy: { ready: Boolean(dep.ready), missing: dep.missing },
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Deploy & platform</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="list-none space-y-1 p-0 text-sm">
          <li className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
            <span>OpenRouter</span>
            <span className="flex items-center gap-2 text-xs text-text-secondary">
              {status?.openrouter?.latency_ms != null
                ? `${status.openrouter.latency_ms}ms`
                : ""}
              <Dot ok={Boolean(status?.openrouter?.ok)} />
            </span>
          </li>
          <li className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
            <span>Code executor</span>
            <span className="flex items-center gap-2 text-xs text-text-secondary">
              {status?.executor?.active ?? "—"}
              <Dot
                ok={Boolean(
                  status?.executor?.nuc?.reachable ||
                    status?.executor?.bridge?.online
                )}
              />
            </span>
          </li>
          <li className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
            <span>GITHUB + VERCEL (deploy)</span>
            <Dot ok={Boolean(status?.deploy?.ready)} />
          </li>
        </ul>
        <p className="text-xs text-text-secondary">
          Smoke-deploy (artifact HTML). Let op: de knop &quot;Restart ai-motor&quot;
          elders op deze pagina is géén app-deploy.
        </p>
        <DeployButton
          source="artifact"
          klant="fumero"
          slug="dev-smoke"
          html="<!DOCTYPE html><html><body><h1>Motor deploy smoke</h1></body></html>"
          environment="preview"
        />
      </CardContent>
    </Card>
  );
}
