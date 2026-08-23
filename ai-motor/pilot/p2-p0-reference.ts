/**
 * One pinned P0 reference for P2 review intake.
 *
 * Not a source registry. This module may know exactly one immutable P0 id.
 * Title + digest only. No P0 call, no body, no volume, no ModelPort.
 */

import { createHash } from "node:crypto";

export const P2_P0_SOURCE_KIND = "p0" as const;
export const P2_P0_TITLE_MAX = 80;

function digestOf(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

export type PinnedP0Reference = {
  readonly source_kind: typeof P2_P0_SOURCE_KIND;
  readonly source_id: string;
  readonly title: string;
  readonly digest: string;
  readonly projectId: "prj-review-keten";
};

/** P0 live SHA from SPINE-CLOSE. One pin, not a catalog. */
export const P2_PINNED_P0_REFERENCE: PinnedP0Reference = Object.freeze({
  source_kind: P2_P0_SOURCE_KIND,
  source_id: "p0-fc37d90c853b4e1760aae7770b14020cf2d9b18e",
  title: "P0 shadow-run",
  digest: digestOf("p0-ref:fc37d90c853b4e1760aae7770b14020cf2d9b18e"),
  projectId: "prj-review-keten",
});

export function isBoundedP0Title(title: unknown): title is string {
  if (typeof title !== "string") return false;
  if (title.length < 1 || title.length > P2_P0_TITLE_MAX) return false;
  if (/[\n\r\t\0]/.test(title)) return false;
  if (title.startsWith("sha256:")) return false;
  return true;
}

export function resolvePinnedP0Reference(sourceId: unknown): PinnedP0Reference | null {
  if (sourceId !== P2_PINNED_P0_REFERENCE.source_id) return null;
  return P2_PINNED_P0_REFERENCE;
}
