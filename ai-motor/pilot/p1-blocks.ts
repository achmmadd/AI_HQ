/**
 * P1.6 BlockManifest viewer — composition data only.
 * Blocks do not execute, are not SSOT, and have no authority.
 */

import { HOME_TENANT_ID, type FoundationViewModel, type P1BlockManifest } from "./p1-foundation.ts";
import { resolveMotorShell, type ShellWriteReason } from "./p1-shell.ts";

export type BlockCard = {
  readonly id: string;
  readonly name: string;
  readonly schema: readonly string[];
  readonly scopes: readonly string[];
  readonly effects: readonly string[];
  readonly risk: P1BlockManifest["risk"];
  readonly evidenceDigest: string;
};

export type BlockGallery = {
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly cards: readonly BlockCard[];
  readonly executable: false;
  readonly authority: false;
};

export type BlockAccess =
  | { readonly ok: true; readonly gallery: BlockGallery }
  | { readonly ok: false; readonly reason: ShellWriteReason; readonly gallery: null };

export function blockIsExecutable(_block: P1BlockManifest): false {
  return false;
}

export function openBlockGallery(input: {
  readonly authenticated: boolean;
  readonly workspace?: string | null;
  readonly view: FoundationViewModel;
}): BlockAccess {
  const access = resolveMotorShell({
    authenticated: input.authenticated,
    requested: { workspace: input.workspace },
  });
  if (!access.ok) return { ok: false, reason: access.reason, gallery: null };
  if (input.view.tenantId !== HOME_TENANT_ID) {
    return { ok: false, reason: "tenant_denied", gallery: null };
  }
  const cards = input.view.blocks
    .filter((block) => block.tenantId === HOME_TENANT_ID)
    .map((block) =>
      Object.freeze({
        id: block.id,
        name: block.name,
        schema: block.schema,
        scopes: block.scopes,
        effects: block.effects,
        risk: block.risk,
        evidenceDigest: block.evidence.digest,
      }),
    );
  return {
    ok: true,
    gallery: Object.freeze({
      tenantId: HOME_TENANT_ID,
      cards: Object.freeze(cards),
      executable: false,
      authority: false,
    }),
  };
}

export function galleryHasExecuteSurface(gallery: BlockGallery): boolean {
  const blob = JSON.stringify(gallery);
  return /execute|invoke|authority:\s*true|executable:\s*true/i.test(blob);
}
