import { NextRequest, NextResponse } from "next/server";
import { sendServiceDownAlert } from "@/lib/alerting";
import { assertCronSecret } from "@/lib/cron-secret";
import { runDependencyChecks } from "@/lib/dependency-checks";

export const runtime = "nodejs";

type ServiceName = "n8n" | "dify" | "qdrant";

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const deps = await runDependencyChecks();
  const core: Array<{ name: ServiceName; ok: boolean; detail?: string }> = [
    {
      name: "n8n",
      ok: deps.n8n.ok,
      detail: deps.n8n.error || `HTTP ${deps.n8n.status}`,
    },
    {
      name: "dify",
      ok: deps.dify.ok,
      detail: deps.dify.error || `HTTP ${deps.dify.status}`,
    },
    {
      name: "qdrant",
      ok: deps.qdrant.ok,
      detail: deps.qdrant.error || `HTTP ${deps.qdrant.status}`,
    },
  ];

  const alerts: string[] = [];
  for (const service of core) {
    if (!service.ok) {
      const sent = await sendServiceDownAlert(service.name, service.detail);
      if (sent) alerts.push(service.name);
    }
  }

  return NextResponse.json({
    ok: core.every((service) => service.ok),
    checked: core.map((service) => ({
      service: service.name,
      ok: service.ok,
    })),
    alerts_sent: alerts,
  });
}
