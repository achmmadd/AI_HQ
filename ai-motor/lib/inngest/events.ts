/** Canonical Inngest event names for Motor workflows. */

export const INNGEST_EVENTS = {
  approvalRequested: "motor/approval.requested",
  approvalDecided: "motor/approval.decided",
  approvalReminder: "motor/approval.reminder",
  /** Relay from n8n webhook adapter */
  n8nRelay: "motor/n8n.relay",
} as const;

export type ApprovalRequestedData = {
  approvalId: number;
  title: string;
  action: string;
  klant?: string | null;
  requestedBy?: string | null;
  timeoutHours?: number;
};

export type ApprovalDecidedData = {
  approvalId: number;
  status: "approved" | "rejected";
  decidedBy?: string | null;
};

export type N8nRelayData = {
  workflow?: string;
  runId?: string;
  payload?: Record<string, unknown>;
};
