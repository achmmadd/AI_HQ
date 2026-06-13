import assert from "node:assert/strict";
import test from "node:test";
import {
  describeQdrantCollectionsForScope,
  qdrantCollectionForScope,
  qdrantIngestCollectionForScope,
  qdrantLegacyCollection,
  qdrantSearchCollectionsForScope,
} from "@/lib/qdrant-collection";

const envBackup = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
});

test("ingest and primary search bucket share SSOT", () => {
  assert.equal(qdrantIngestCollectionForScope("fumero"), "factory_os_fumero");
  assert.equal(qdrantCollectionForScope("fumero"), "factory_os_fumero");
  assert.equal(
    qdrantSearchCollectionsForScope("fumero")[0],
    qdrantIngestCollectionForScope("fumero")
  );
});

test("dual-search includes scrape bucket for fumero and bokas", () => {
  assert.deepEqual(qdrantSearchCollectionsForScope("fumero"), [
    "factory_os_fumero",
    "fumero_kennisbank",
  ]);
  assert.deepEqual(qdrantSearchCollectionsForScope("bokas"), [
    "factory_os_bokas",
    "bokas_kennisbank",
  ]);
});

test("motor scope uses ingest-only search (no scrape bucket)", () => {
  assert.deepEqual(qdrantSearchCollectionsForScope("motor"), ["factory_os_motor"]);
});

test("describeQdrantCollectionsForScope exposes ingest vs search plan", () => {
  const plan = describeQdrantCollectionsForScope("fumero");
  assert.equal(plan.klant, "fumero");
  assert.equal(plan.ingest, "factory_os_fumero");
  assert.equal(plan.scrape, "fumero_kennisbank");
  assert.deepEqual(plan.search, ["factory_os_fumero", "fumero_kennisbank"]);
  assert.equal(plan.legacy, qdrantLegacyCollection());
  assert.notEqual(plan.legacy, plan.ingest);
});

test("custom prefix applies to ingest and search consistently", () => {
  process.env.QDRANT_COLLECTION_PREFIX = "acme_kb";
  assert.equal(qdrantIngestCollectionForScope("bokas"), "acme_kb_bokas");
  assert.equal(
    qdrantSearchCollectionsForScope("bokas")[0],
    "acme_kb_bokas"
  );
});

test("scrape collection env override is reflected in search plan", () => {
  process.env.QDRANT_FUMERO_KENNISBANK_COLLECTION = "fumero_scrape_v2";
  const plan = describeQdrantCollectionsForScope("fumero");
  assert.equal(plan.scrape, "fumero_scrape_v2");
  assert.deepEqual(plan.search, ["factory_os_fumero", "fumero_scrape_v2"]);
});
