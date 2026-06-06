/**
 * Inngest client (Sprint 2.2).
 * Graceful no-op when INNGEST_* keys are unset — worker runs on Hetzner in prod.
 */

import { Inngest } from "inngest";

export function isInngestDevMode(): boolean {
  return (
    process.env.INNGEST_DEV === "1" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  );
}

/** True when Cloud keys are set, or local dev server mode is explicit. */
export function isInngestConfigured(): boolean {
  if (process.env.INNGEST_DEV === "1") return true;
  return Boolean(
    process.env.INNGEST_SIGNING_KEY?.trim() &&
      process.env.INNGEST_EVENT_KEY?.trim()
  );
}

export const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID?.trim() || "motor-ai",
});

export type InngestSendResult = { sent: boolean; skipped?: boolean; error?: string };

/** Send an event; no-op when Inngest is not configured (unless INNGEST_DEV=1). */
export async function sendInngestEvent(
  name: string,
  data: Record<string, unknown>,
  opts?: { id?: string }
): Promise<InngestSendResult> {
  if (!isInngestConfigured()) {
    return { sent: false, skipped: true };
  }

  try {
    await inngest.send({
      name,
      data,
      ...(opts?.id ? { id: opts.id } : {}),
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[inngest] send failed:", message);
    return { sent: false, error: message };
  }
}
