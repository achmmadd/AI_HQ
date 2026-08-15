import assert from "node:assert/strict";
import { test } from "node:test";
import { HOME_TENANT_ID, OTHER_TENANT_ID, serializeFoundationView } from "./p1-foundation.ts";
import { blockIsExecutable, galleryHasExecuteSurface, openBlockGallery } from "./p1-blocks.ts";

const home = serializeFoundationView(HOME_TENANT_ID)!;

test("P1.6 BlockManifest gallery is composition-only", () => {
  const opened = openBlockGallery({
    authenticated: true,
    workspace: HOME_TENANT_ID,
    view: home,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.gallery.executable, false);
  assert.equal(opened.gallery.authority, false);
  assert.ok(opened.gallery.cards.length > 0);
  for (const card of opened.gallery.cards) {
    assert.ok(card.evidenceDigest.startsWith("sha256:"));
    assert.equal("execute" in card, false);
  }
  assert.equal(galleryHasExecuteSurface(opened.gallery), false);
  for (const block of home.blocks) {
    assert.equal(blockIsExecutable(block), false);
  }
});

test("P1.6 other tenant cannot open the block gallery", () => {
  const other = serializeFoundationView(OTHER_TENANT_ID)!;
  const opened = openBlockGallery({
    authenticated: true,
    workspace: OTHER_TENANT_ID,
    view: other,
  });
  assert.equal(opened.ok, false);
  if (opened.ok) return;
  assert.equal(opened.reason, "tenant_denied");
});
