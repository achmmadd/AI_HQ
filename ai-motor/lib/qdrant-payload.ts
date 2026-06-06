/**
 * Qdrant multitenant payload fields (Sprint 1.3 — ADR-001).
 * All ingest paths set workspace_id + tenant + source; searches filter on these.
 */

export type QdrantPayloadSource = "file" | "scrape";

/** Canonical payload keys for workspace isolation. */
export type QdrantMultitenantFields = {
  workspace_id?: string;
  tenant: string;
  source: QdrantPayloadSource;
  /** Legacy alias — kept for backward compat with pre-1.3 vectors. */
  client: string;
};

export function buildMultitenantPayloadFields(opts: {
  tenant: string;
  source: QdrantPayloadSource;
  workspaceId?: string | null;
}): QdrantMultitenantFields {
  const tenant = opts.tenant.trim().toLowerCase();
  const fields: QdrantMultitenantFields = {
    tenant,
    client: tenant,
    source: opts.source,
  };
  if (opts.workspaceId) {
    fields.workspace_id = opts.workspaceId;
  }
  return fields;
}

/**
 * Qdrant filter: workspace + tenant on every search.
 * Legacy vectors without workspace_id or tenant still match via `client`.
 */
export function buildQdrantSearchFilter(opts: {
  tenant?: string | null;
  workspaceId?: string | null;
}): Record<string, unknown> | undefined {
  const tenant = (opts.tenant || "").trim().toLowerCase();
  const must: Array<Record<string, unknown>> = [];

  if (tenant) {
    must.push({
      should: [
        { key: "tenant", match: { value: tenant } },
        { key: "client", match: { value: tenant } },
      ],
    });
  }

  if (opts.workspaceId) {
    must.push({
      should: [
        { key: "workspace_id", match: { value: opts.workspaceId } },
        { is_empty: { key: "workspace_id" } },
      ],
    });
  }

  if (must.length === 0) return undefined;
  return { must };
}
