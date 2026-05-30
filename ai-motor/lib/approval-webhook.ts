/**
 * Optionele webhook na goedkeuring (bijv. publicatie / downstream).
 * Zet APPROVAL_WEBHOOK_URL in de omgeving.
 */
export async function notifyApprovalWebhook(payload: {
  event: "approval_resolved";
  status: "approved" | "rejected";
  id: number;
  klant: string | null;
  title: string;
  action: string;
  payload: unknown;
  resolved_by: string | null;
  reject_reason: string | null;
  revision_note: string | null;
  resolved_at: string | null;
}): Promise<void> {
  const url = process.env.APPROVAL_WEBHOOK_URL?.trim();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        source: "factory-os",
        app: "ai-motor",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* webhook is best-effort */
  }
}
