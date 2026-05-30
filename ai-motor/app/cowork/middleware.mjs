/**
 * Redirect /approvals → Cowork inbox (sidebar OK-tab).
 * Telegram deep-links (?approve= / ?reject=) blijven op /approvals.
 */
export const approvalsCoworkRedirect = {
  source: "/approvals",
  destination: "/cowork?tab=approvals",
  permanent: false,
  missing: [
    { type: "query", key: "approve" },
    { type: "query", key: "reject" },
  ],
};
