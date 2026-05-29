import db from "@/lib/db/database";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import type {
  PhotoStudioCoachLayer,
  SiteConversionAttribution,
  SocialClickAttribution,
} from "@/lib/photo-studio/analytics/attribution";
import {
  photoStudioCoachStub,
  siteConversionAttributionStub,
  socialClickAttributionStub,
} from "@/lib/photo-studio/analytics/attribution";

let analyticsSchemaDone = false;

function ensureAnalyticsSchema(): void {
  if (analyticsSchemaDone) return;
  ensurePhotoStudioSchema();
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_studio_attribution_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ps_attr_tracking
      ON photo_studio_attribution_events(tracking_id);
  `);
  analyticsSchemaDone = true;
}

export function getTrackingIdForGeneration(generationId: number): string | null {
  ensurePhotoStudioSchema();
  const row = db
    .prepare(`SELECT tracking_id FROM photo_studio_generations WHERE id = ?`)
    .get(generationId) as { tracking_id: string } | undefined;
  return row?.tracking_id ?? null;
}

/** Register event slot — no synthetic metrics. */
export function registerAttributionEvent(
  trackingId: string,
  eventType: "social_click" | "site_conversion" | "impression",
  payload?: Record<string, unknown>
): void {
  ensureAnalyticsSchema();
  db.prepare(
    `INSERT INTO photo_studio_attribution_events (tracking_id, event_type, payload_json)
     VALUES (?, ?, ?)`
  ).run(trackingId, eventType, payload ? JSON.stringify(payload) : null);
}

export function attributionHooksFor(trackingId: string): {
  social: SocialClickAttribution;
  conversion: SiteConversionAttribution;
  coach: PhotoStudioCoachLayer;
} {
  return {
    social: { ...socialClickAttributionStub, trackingId, platform: "instagram" },
    conversion: { ...siteConversionAttributionStub, trackingId },
    coach: photoStudioCoachStub,
  };
}
