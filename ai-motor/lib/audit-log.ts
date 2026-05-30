import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";

export function logAudit(opts: {
  actor?: string | null;
  action: string;
  resource?: string | null;
  detail?: Record<string, unknown> | null;
  klant?: string | null;
}): void {
  ensurePlatformSchema();
  db.prepare(
    `INSERT INTO audit_logs (actor, action, resource, detail_json, klant)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    opts.actor ?? "system",
    opts.action.slice(0, 128),
    opts.resource?.slice(0, 256) ?? null,
    opts.detail ? JSON.stringify(opts.detail).slice(0, 8000) : null,
    opts.klant ?? null
  );
}
