/**
 * One pinned P0 reference for P2 review intake.
 *
 * Not a source registry. This module may know exactly one immutable P0 id.
 * Title + digest only. No P0 call, no body, no volume, no ModelPort.
 */

export const P2_P0_SOURCE_KIND = "p0" as const;
export const P2_P0_TITLE_MAX = 80;

export type PinnedP0Reference = {
  readonly source_kind: typeof P2_P0_SOURCE_KIND;
  readonly source_id: string;
  readonly title: string;
  readonly digest: string;
  readonly projectId: "prj-review-keten";
};

export type P0ReferenceResolver = (sourceId: unknown) => PinnedP0Reference | null;

/**
 * Existing non-synthetic P0 result observed read-only in the P0 store.
 * Stored 2026-08-14T12:43:37.715Z with draft_len 1294. One pin, not a catalog.
 */
export const P2_PINNED_P0_REFERENCE: PinnedP0Reference = Object.freeze({
  source_kind: P2_P0_SOURCE_KIND,
  source_id: "run-shadow-1786711414803",
  title: "P0 shadow-run",
  digest: "sha256:d6c6fe34d63790c3eb8f99cb394f2846accc0f88169479ecdc2ed17923f7e7f3",
  projectId: "prj-review-keten",
});

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

export function isBoundedP0Title(title: unknown): title is string {
  if (typeof title !== "string") return false;
  if (title.length < 1 || title.length > P2_P0_TITLE_MAX) return false;
  if (hasControlCharacter(title)) return false;
  if (title.startsWith("sha256:")) return false;
  return true;
}

export function resolvePinnedP0Reference(sourceId: unknown): PinnedP0Reference | null {
  if (sourceId !== P2_PINNED_P0_REFERENCE.source_id) return null;
  return P2_PINNED_P0_REFERENCE;
}
