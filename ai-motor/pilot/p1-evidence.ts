/**
 * P1.5 Workspace evidence rail — IDs, hashes and status only.
 * Never draft text, context text, secrets or raw logs.
 */

import { HOME_TENANT_ID, OTHER_TENANT_ID, type FoundationViewModel } from "./p1-foundation.ts";
import { resolveMotorShell, type ShellWriteReason } from "./p1-shell.ts";

export type WorkspaceEvidenceRef = {
  readonly id: string;
  readonly kind: "reference" | "digest" | "receipt" | "hash" | "block";
  readonly status: "ready" | "missing";
  readonly digest?: string;
  readonly source: "attention" | "draft" | "review" | "publish" | "block";
};

export type WorkspaceEvidenceRail = {
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly refs: readonly WorkspaceEvidenceRef[];
};

export type EvidenceAccess =
  | { readonly ok: true; readonly rail: WorkspaceEvidenceRail }
  | { readonly ok: false; readonly reason: ShellWriteReason; readonly rail: null };

function push(
  refs: WorkspaceEvidenceRef[],
  seen: Set<string>,
  ref: WorkspaceEvidenceRef,
): void {
  const key = `${ref.source}:${ref.id}:${ref.digest ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  refs.push(Object.freeze(ref));
}

export function collectWorkspaceEvidence(view: FoundationViewModel): WorkspaceEvidenceRail {
  const refs: WorkspaceEvidenceRef[] = [];
  const seen = new Set<string>();

  for (const item of view.now.items) {
    if (item.tenantId !== HOME_TENANT_ID) continue;
    if (item.references.evidenceId) {
      push(refs, seen, {
        id: item.references.evidenceId,
        kind: "reference",
        status: "ready",
        source: "attention",
      });
    }
  }

  for (const row of view.projects) {
    for (const draft of row.drafts) {
      if (draft.tenantId !== HOME_TENANT_ID) continue;
      push(refs, seen, {
        id: draft.id,
        kind: "hash",
        status: "ready",
        digest: draft.bodyDigest,
        source: "draft",
      });
    }
    for (const review of row.reviews) {
      if (review.tenantId !== HOME_TENANT_ID) continue;
      push(refs, seen, {
        id: review.id,
        kind: "receipt",
        status: "ready",
        source: "review",
      });
    }
    for (const publish of row.publishes) {
      if (publish.tenantId !== HOME_TENANT_ID) continue;
      push(refs, seen, {
        id: publish.id,
        kind: "receipt",
        status: publish.decision === "DENY" ? "ready" : "missing",
        source: "publish",
      });
    }
  }

  for (const block of view.blocks) {
    if (block.tenantId !== HOME_TENANT_ID) continue;
    push(refs, seen, {
      id: block.id,
      kind: "block",
      status: "ready",
      digest: block.evidence.digest,
      source: "block",
    });
  }

  return Object.freeze({ tenantId: HOME_TENANT_ID, refs: Object.freeze(refs) });
}

export function openEvidenceRail(input: {
  readonly authenticated: boolean;
  readonly workspace?: string | null;
  readonly tenant?: string | null;
  readonly pathSegments?: readonly string[];
  readonly query?: Readonly<Record<string, string | string[] | undefined>>;
  readonly view: FoundationViewModel;
}): EvidenceAccess {
  const access = resolveMotorShell({
    authenticated: input.authenticated,
    requested: {
      workspace: input.workspace,
      tenant: input.tenant,
      pathSegments: input.pathSegments,
      query: input.query,
    },
  });
  if (!access.ok) return { ok: false, reason: access.reason, rail: null };
  if (input.view.tenantId !== HOME_TENANT_ID) {
    return { ok: false, reason: "tenant_denied", rail: null };
  }
  return { ok: true, rail: collectWorkspaceEvidence(input.view) };
}

export function evidenceRailLeaksContent(
  rail: WorkspaceEvidenceRail,
  markers: readonly string[],
): boolean {
  const blob = JSON.stringify(rail);
  return markers.some((marker) => marker.length > 0 && blob.includes(marker));
}

export function foreignTenantEvidenceDenied(): ShellWriteReason {
  void OTHER_TENANT_ID;
  return "tenant_denied";
}
